"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Download, Loader2, Share2, Trash2, Undo2, X } from "lucide-react";
import { api, ApiError, getShareDownloadUrl } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { getIncludeWhatsappPreview, setIncludeWhatsappPreview } from "@/lib/share-preferences";
import { taxBreakdownLabel } from "@/lib/tax";
import type { PaymentMethodOption, QuotationStatusValue, QuotationStockCheckItem, SharedDocument } from "@/lib/types";
import { CheckboxField } from "./CheckboxField";
import { RequestReturnModal } from "./RequestReturnModal";

const KIND_LABEL: Record<SharedDocument["documentKind"], string> = {
  receipt: "Receipt",
  invoice: "Invoice",
  quotation: "Quotation",
};

const STATUS_TONE: Record<string, string> = {
  paid: "border-green text-green",
  overdue: "border-red text-red",
  partially_paid: "border-gold text-gold-text",
  unpaid: "border-blue text-blue",
  cancelled: "border-navy/30 text-navy/50",
  draft: "border-navy/30 text-navy/50",
  sent: "border-gold text-gold-text",
  accepted: "border-green text-green",
  rejected: "border-red text-red",
  expired: "border-red text-red",
  converted: "border-green text-green",
};

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

/** Bottom-sheet document viewer — same shell as PayslipModal, extended with Download and Share since
 * those weren't needed there. Shared by both the Sales and Invoices tabs (a Sale row IS an invoice
 * once invoiceNumber is set — same table, same `/mobile/sales/:id` endpoint, same shape) rather than
 * two near-identical components. Fetches the full document itself (the list only ever has summary
 * fields) via the SAME view-model SERVER's Share feature and DESKTOP's own downloaded PDF both
 * render from (buildSharedDocument, reused directly — see mobile-sales-service.ts), so the numbers
 * shown here can never drift from what Download produces.
 *
 * Download and Share both mint a fresh share-link token (mobile-auth-gated version of the same
 * createShareLink DESKTOP's ShareModal calls) and then:
 *  - Download hits SERVER's existing /share/:token/download directly — a real PDF via
 *    Content-Disposition: attachment, so it's a file save, not a page navigation. Byte-identical to
 *    what DESKTOP itself would generate, since it's the literal same generator.
 *  - Share uses the mobile Web Share API (the native OS share sheet) rather than rebuilding
 *    DESKTOP's phone-number-entry form — that's the idiomatic mobile pattern, and neither action
 *    ever navigates the page to a different origin, which matters for a PWA (see this app's own
 *    design notes on why the Owner App doesn't redirect to the SHARE app for viewing).
 *
 * `kind` picks the fetch endpoint and the share entity — a Quotation is its own table (unlike an
 * Invoice, which is just a Sale row), so it can't reuse GET /mobile/sales/:id. The rendered
 * SharedDocument shape is identical either way, so only the fetch/share plumbing branches.
 */
export function DocumentDetailModal({
  saleId,
  kind = "sale",
  onClose,
  onChanged,
  onEdit,
  canApprove = false,
}: {
  saleId: string;
  kind?: "sale" | "quotation";
  onClose: () => void;
  /** Fired after any mutating action below (payment recorded, status changed, converted, cancelled,
   * deleted) — lets the parent tab refresh its own list (balances/statuses shown there would
   * otherwise go stale until the next natural reload). */
  onChanged?: () => void;
  /** Present only when the parent tab can open its own InvoiceFormModal/QuotationFormModal in edit
   * mode — this modal doesn't own branchId/currency/tenantTaxConfig itself, so editing is delegated
   * back up rather than duplicating that plumbing here. Omitted entirely (no Edit button shown) for
   * a context that can't edit, e.g. read-only surfaces. */
  onEdit?: () => void;
  /** Whether the signed-in employee has approvals.approve — the same permission DESKTOP's own
   * cancelInvoiceDirect requires. True shows the existing self-approved "Cancel Invoice" flow; false
   * shows "Request Cancellation" instead (asks a reason, sits pending until someone with this
   * permission decides it from the Approvals tab). */
  canApprove?: boolean;
}) {
  const [doc, setDoc] = useState<SharedDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [includeWhatsappPreview, setIncludeWhatsappPreviewState] = useState(() => getIncludeWhatsappPreview());

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[] | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [convertSaleOpen, setConvertSaleOpen] = useState(false);
  const [convertInvoiceOpen, setConvertInvoiceOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [requestCancelOpen, setRequestCancelOpen] = useState(false);
  const [requestCancelReason, setRequestCancelReason] = useState("");
  const [requestCancelNotes, setRequestCancelNotes] = useState("");
  const [requestCancelSent, setRequestCancelSent] = useState(false);
  const [requestReturnOpen, setRequestReturnOpen] = useState(false);
  const [requestReturnSent, setRequestReturnSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [stockCheck, setStockCheck] = useState<QuotationStockCheckItem[] | null>(null);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const [convertPaymentMethodId, setConvertPaymentMethodId] = useState("");
  const [convertAmountReceived, setConvertAmountReceived] = useState("");
  const [convertDueDate, setConvertDueDate] = useState("");

  function reload(): void {
    const fetchDoc = kind === "quotation" ? api.getQuotation(saleId) : api.getSale(saleId);
    fetchDoc.then(setDoc).catch(() => undefined);
  }

  useEffect(() => {
    let cancelled = false;
    const fetchDoc = kind === "quotation" ? api.getQuotation(saleId) : api.getSale(saleId);
    fetchDoc
      .then((result) => {
        if (!cancelled) setDoc(result);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Could not load this document.");
      });
    return () => {
      cancelled = true;
    };
  }, [saleId, kind]);

  function ensurePaymentMethods(): void {
    if (paymentMethods) return;
    api.listPaymentMethods().then(setPaymentMethods).catch(() => undefined);
  }

  async function runAction(name: string, action: () => Promise<unknown>): Promise<void> {
    setBusyAction(name);
    setActionError(null);
    try {
      await action();
      onChanged?.();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "That action failed — check your connection and try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRecordPayment(): Promise<void> {
    if (!paymentMethodId || !paymentAmount.trim()) {
      setActionError("Choose a payment method and amount.");
      return;
    }
    await runAction("payment", async () => {
      await api.recordInvoicePayment(saleId, {
        paymentMethodId,
        amountCents: Math.round(Number(paymentAmount) * 100),
        reference: paymentReference.trim() || undefined,
      });
      setPaymentModalOpen(false);
      setPaymentAmount("");
      setPaymentReference("");
      reload();
    });
  }

  async function handleDuplicate(): Promise<void> {
    await runAction("duplicate", async () => {
      const result = await api.duplicateInvoice(saleId);
      setNotice("Duplicate created — find it in your Invoices list.");
      void result;
    });
  }

  async function handleCancel(): Promise<void> {
    await runAction("cancel", async () => {
      await api.cancelInvoice(saleId);
      setConfirmCancel(false);
      reload();
    });
  }

  async function handleRequestCancel(): Promise<void> {
    if (!requestCancelReason.trim()) {
      setActionError("A reason is required.");
      return;
    }
    await runAction("requestCancel", async () => {
      await api.requestInvoiceCancellation(saleId, { reason: requestCancelReason.trim(), notes: requestCancelNotes.trim() || undefined });
      setRequestCancelOpen(false);
      setRequestCancelSent(true);
    });
  }

  async function handleSetStatus(status: QuotationStatusValue): Promise<void> {
    await runAction(`status:${status}`, async () => {
      await api.setQuotationStatus(saleId, status);
      reload();
    });
  }

  async function handleCheckStock(): Promise<void> {
    await runAction("stockCheck", async () => {
      const result = await api.checkQuotationStock(saleId);
      setStockCheck(result);
    });
  }

  async function handleConvertToSale(): Promise<void> {
    if (!convertPaymentMethodId) {
      setActionError("Choose a payment method.");
      return;
    }
    await runAction("convertSale", async () => {
      const result = await api.convertQuotationToSale(saleId, {
        paymentMethodId: convertPaymentMethodId,
        amountReceivedCents: convertAmountReceived.trim() ? Math.round(Number(convertAmountReceived) * 100) : null,
      });
      setConvertSaleOpen(false);
      setNotice("Converted to a completed sale — find it in your Sales list.");
      void result;
    });
  }

  async function handleConvertToInvoice(): Promise<void> {
    if (!convertDueDate) {
      setActionError("Choose a due date.");
      return;
    }
    await runAction("convertInvoice", async () => {
      const result = await api.convertQuotationToInvoice(saleId, { dueDate: convertDueDate });
      setConvertInvoiceOpen(false);
      setNotice("Converted to an invoice — find it in your Invoices list.");
      void result;
    });
  }

  async function handleDelete(): Promise<void> {
    await runAction("delete", async () => {
      await api.deleteQuotation(saleId);
      onClose();
    });
  }

  async function handleDownload(): Promise<void> {
    setDownloading(true);
    setActionError(null);
    setNotice(null);
    try {
      const link = await api.createShareLink(kind, saleId, true);
      const token = link.url.split("/").pop() as string;
      const anchor = document.createElement("a");
      anchor.href = getShareDownloadUrl(token);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setNotice("Downloading — check your device's Downloads.");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't prepare the download.");
    } finally {
      setDownloading(false);
    }
  }

  function handleToggleIncludeWhatsappPreview(next: boolean): void {
    setIncludeWhatsappPreviewState(next);
    setIncludeWhatsappPreview(next);
  }

  async function handleToggleTaxBreakdown(next: boolean): Promise<void> {
    await runAction("toggleTax", async () => {
      await api.setIncludeTaxBreakdown(kind, saleId, next);
      reload();
    });
  }

  async function handleToggleBusinessInfo(next: boolean): Promise<void> {
    await runAction("toggleBusinessInfo", async () => {
      await api.setIncludeBusinessInfo(kind, saleId, next);
      reload();
    });
  }

  async function handleShare(): Promise<void> {
    setSharing(true);
    setActionError(null);
    setNotice(null);
    try {
      const link = await api.createShareLink(kind, saleId, includeWhatsappPreview);
      if (navigator.share) {
        await navigator.share({ title: documentLabel, text: link.message, url: link.url });
      } else {
        await navigator.clipboard.writeText(`${link.message}\n\n${link.url}`);
        setNotice("Copied to clipboard — paste it anywhere to share.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return; // user dismissed the native share sheet
      setActionError(err instanceof ApiError ? err.message : "Couldn't prepare this share.");
    } finally {
      setSharing(false);
    }
  }

  const documentLabel = doc ? `${KIND_LABEL[doc.documentKind]} ${doc.documentNumber ?? ""}`.trim() : "Document";
  const money = (cents: number | null) => (doc && cents !== null ? formatCents(cents, doc.currency) : "-");
  const statusValue = doc?.quotationStatus ?? doc?.paymentStatus ?? null;
  const statusTone = statusValue ? (STATUS_TONE[statusValue] ?? "border-navy/30 text-navy/50") : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display text-lg text-navy">{documentLabel}</p>
              {statusValue && statusTone && (
                <span className={`rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${statusTone}`}>
                  {formatStatus(statusValue)}
                </span>
              )}
            </div>
            {doc && <p className="text-xs text-navy/50">{new Date(doc.dateLabel).toLocaleString()}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {loadError && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{loadError}</p>}
        {!doc && !loadError && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}

        {doc && (
          <>
            <div className="rounded-lg border border-dashed border-navy/15 bg-cream-dark/40 p-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-navy">{doc.businessName}</p>
                {doc.physicalAddress && <p className="text-xs text-navy/50">{doc.physicalAddress}</p>}
                {doc.primaryPhone && <p className="text-xs text-navy/50">{doc.primaryPhone}</p>}
                {doc.receiptHeader && <p className="mt-1 text-xs text-navy/50">{doc.receiptHeader}</p>}
              </div>

              <div className="my-3 border-t border-dashed border-navy/15" />
              <div className="space-y-0.5 text-xs text-navy/70">
                {doc.includeBusinessInfo && (
                  <Row label="Served by" value={doc.branchName ? `${doc.employeeName} · ${doc.branchName}` : doc.employeeName} />
                )}
                {doc.customerName && <Row label="Customer" value={doc.customerName} />}
                {doc.dueDate && <Row label="Due" value={new Date(doc.dueDate).toLocaleDateString()} />}
                {doc.validUntil && <Row label="Valid until" value={new Date(doc.validUntil).toLocaleDateString()} />}
              </div>

              <div className="my-3 border-t border-dashed border-navy/15" />
              <div className="space-y-2">
                {[...doc.items, ...doc.extraLines].map((item, index) => (
                  <div key={index} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-navy">{item.name}</p>
                      <p className="text-navy/40">
                        {item.quantity} x {money(item.unitPriceCents)}
                      </p>
                    </div>
                    <p className="flex-none font-bold text-navy">{money(item.lineTotalCents)}</p>
                  </div>
                ))}
              </div>

              <div className="my-3 border-t border-dashed border-navy/15" />
              <div className="space-y-1 text-xs">
                <Row label="Subtotal" value={money(doc.subtotalCents)} />
                {doc.discountAmountCents > 0 && <Row label="Discount" value={`-${money(doc.discountAmountCents)}`} />}
                {doc.includeTaxBreakdown && doc.addedTaxCents > 0 && <Row label="Total Tax" value={money(doc.addedTaxCents)} />}
                <Row label="Total" value={money(doc.grandTotalCents)} strong />
                {doc.balanceDueCents !== null && doc.balanceDueCents > 0 && (
                  <Row label="Balance Due" value={money(doc.balanceDueCents)} strong className="text-red" />
                )}
              </div>

              {doc.includeTaxBreakdown && doc.taxBreakdown.length > 0 && (
                <>
                  <div className="my-3 border-t border-dashed border-navy/15" />
                  <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-navy/50">Tax Breakdown</p>
                  <div className="space-y-1 text-xs">
                    {doc.taxBreakdown.map((entry) => (
                      <div key={`${entry.taxType}:${entry.pricingMode ?? ""}`} className="flex justify-between gap-2">
                        <span className="font-bold text-navy">
                          {taxBreakdownLabel(entry.taxType, doc.vatRatePercent, entry.pricingMode)}
                        </span>
                        <span className="text-navy/70">
                          Net {money(entry.netCents)} / Tax {money(entry.taxCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(doc.paymentMethodName || doc.paymentReference) && (
                <>
                  <div className="my-3 border-t border-dashed border-navy/15" />
                  <div className="space-y-0.5 text-xs text-navy/70">
                    {doc.paymentMethodName && <Row label="Payment" value={doc.paymentMethodName} />}
                    {doc.paymentReference && <Row label="Ref" value={doc.paymentReference} />}
                  </div>
                </>
              )}

              {doc.receiptFooter && (
                <>
                  <div className="my-3 border-t border-dashed border-navy/15" />
                  <p className="text-center text-xs text-navy/50">{doc.receiptFooter}</p>
                </>
              )}
            </div>

            {doc && (
              <CheckboxField
                label="Include tax information"
                description="Shows the Tax Breakdown section on this document's print, download, and share"
                checked={doc.includeTaxBreakdown}
                onChange={(checked) => void handleToggleTaxBreakdown(checked)}
              />
            )}

            {doc && (
              <CheckboxField
                label="Include storefront information"
                description="Shows the shop name, logo, address, contacts and header/footer text. Turn off for a fully anonymous document."
                checked={doc.includeBusinessInfo}
                onChange={(checked) => void handleToggleBusinessInfo(checked)}
              />
            )}

            <CheckboxField
              label="Include WhatsApp preview"
              description="Shares the full formatted document text alongside the link, not just a short summary"
              checked={includeWhatsappPreview}
              onChange={handleToggleIncludeWhatsappPreview}
            />

            {actionError && (
              <p className="mt-3 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{actionError}</p>
            )}
            {notice && <p className="mt-3 text-center text-xs text-navy/50">{notice}</p>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloading}
                className="flex items-center justify-center gap-2 rounded-lg border border-navy/20 bg-white py-3 text-xs font-bold text-navy disabled:opacity-50"
              >
                {downloading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
                Download
              </button>
              <button
                type="button"
                onClick={() => void handleShare()}
                disabled={sharing}
                className="flex items-center justify-center gap-2 rounded-lg bg-navy py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                {sharing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
                Share
              </button>
            </div>

            {doc.documentKind === "invoice" && doc.paymentStatus !== "cancelled" && (
              <div className="mt-3 space-y-2 border-t border-dashed border-navy/15 pt-3">
                {doc.balanceDueCents !== null && doc.balanceDueCents > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      ensurePaymentMethods();
                      setPaymentAmount(((doc.balanceDueCents as number) / 100).toFixed(2));
                      setActionError(null);
                      setPaymentModalOpen(true);
                    }}
                    className="w-full rounded-lg border border-blue/30 bg-blue/5 py-2.5 text-xs font-bold text-blue"
                  >
                    Record Payment
                  </button>
                )}
                {onEdit && doc.payments.length === 0 && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="w-full rounded-lg border border-navy/15 bg-white py-2.5 text-xs font-bold text-navy"
                  >
                    Edit Invoice
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDuplicate()}
                    disabled={busyAction === "duplicate"}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-navy/15 bg-white py-2.5 text-xs font-bold text-navy disabled:opacity-50"
                  >
                    {busyAction === "duplicate" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                    Duplicate
                  </button>
                  {canApprove ? (
                    !confirmCancel ? (
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(true)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-red/30 bg-white py-2.5 text-xs font-bold text-red"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Cancel Invoice
                      </button>
                    ) : (
                      <div className="col-span-2 flex gap-2">
                        <button type="button" onClick={() => setConfirmCancel(false)} className="flex-1 rounded-lg border border-navy/15 bg-white py-2.5 text-xs font-bold text-navy">
                          Never mind
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCancel()}
                          disabled={busyAction === "cancel"}
                          className="flex-1 rounded-lg bg-red py-2.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {busyAction === "cancel" ? "Cancelling…" : "Confirm Cancel"}
                        </button>
                      </div>
                    )
                  ) : requestCancelSent ? (
                    <p className="col-span-2 text-center text-[11px] font-semibold text-navy/50">Cancellation requested — awaiting approval.</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setRequestCancelReason("");
                        setRequestCancelNotes("");
                        setActionError(null);
                        setRequestCancelOpen(true);
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-red/30 bg-white py-2.5 text-xs font-bold text-red"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Request Cancellation
                    </button>
                  )}
                </div>
              </div>
            )}

            {doc.documentKind === "receipt" && (
              <div className="mt-3 border-t border-dashed border-navy/15 pt-3">
                {requestReturnSent ? (
                  <p className="text-center text-[11px] font-semibold text-navy/50">Return requested — awaiting approval.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRequestReturnOpen(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red/30 bg-white py-2.5 text-xs font-bold text-red"
                  >
                    <Undo2 className="size-3.5" aria-hidden="true" />
                    Request Return
                  </button>
                )}
              </div>
            )}

            {doc.documentKind === "quotation" && doc.quotationStatus && (
              <div className="mt-3 space-y-2 border-t border-dashed border-navy/15 pt-3">
                {(doc.quotationStatus === "draft" || doc.quotationStatus === "sent") && (
                  <div className="grid grid-cols-2 gap-2">
                    {doc.quotationStatus === "draft" && (
                      <button
                        type="button"
                        onClick={() => void handleSetStatus("sent")}
                        disabled={busyAction === "status:sent"}
                        className="rounded-lg border border-navy/15 bg-white py-2.5 text-xs font-bold text-navy disabled:opacity-50"
                      >
                        Mark Sent
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSetStatus("accepted")}
                      disabled={busyAction === "status:accepted"}
                      className="rounded-lg border border-green/30 bg-green/5 py-2.5 text-xs font-bold text-green disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSetStatus("rejected")}
                      disabled={busyAction === "status:rejected"}
                      className="rounded-lg border border-red/30 bg-white py-2.5 text-xs font-bold text-red disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {doc.quotationStatus === "rejected" && (
                  <button
                    type="button"
                    onClick={() => void handleSetStatus("draft")}
                    disabled={busyAction === "status:draft"}
                    className="w-full rounded-lg border border-navy/15 bg-white py-2.5 text-xs font-bold text-navy disabled:opacity-50"
                  >
                    Back to Draft
                  </button>
                )}

                {doc.quotationStatus === "accepted" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleCheckStock()}
                      disabled={busyAction === "stockCheck"}
                      className="w-full rounded-lg border border-navy/15 bg-white py-2.5 text-xs font-bold text-navy disabled:opacity-50"
                    >
                      {busyAction === "stockCheck" ? "Checking…" : "Check Stock"}
                    </button>

                    {stockCheck && (
                      <div className="space-y-1 rounded-lg bg-cream-dark/60 p-2.5 text-xs">
                        {stockCheck.length === 0 && <p className="text-navy/50">No stock-tracked items to check.</p>}
                        {stockCheck.map((item) => (
                          <div key={item.productId} className="flex items-center justify-between gap-2">
                            <span className="truncate font-semibold text-navy">{item.productName}</span>
                            <span className={item.sufficient ? "text-green" : "font-bold text-red"}>
                              {item.availableQuantity} / {item.requestedQuantity} available
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          ensurePaymentMethods();
                          setActionError(null);
                          setConvertSaleOpen(true);
                        }}
                        className="rounded-lg bg-blue py-2.5 text-xs font-bold text-white"
                      >
                        Convert to Sale
                      </button>
                      {doc.customerName && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setConvertInvoiceOpen(true);
                          }}
                          className="rounded-lg border border-blue/30 bg-blue/5 py-2.5 text-xs font-bold text-blue"
                        >
                          Convert to Invoice
                        </button>
                      )}
                    </div>
                  </>
                )}

                {doc.quotationStatus === "draft" && (
                  <>
                    {onEdit && (
                      <button
                        type="button"
                        onClick={onEdit}
                        className="w-full rounded-lg border border-navy/15 bg-white py-2.5 text-xs font-bold text-navy"
                      >
                        Edit Quotation
                      </button>
                    )}
                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red/30 bg-white py-2.5 text-xs font-bold text-red"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Delete Draft
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 rounded-lg border border-navy/15 bg-white py-2.5 text-xs font-bold text-navy">
                          Never mind
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete()}
                          disabled={busyAction === "delete"}
                          className="flex-1 rounded-lg bg-red py-2.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {busyAction === "delete" ? "Deleting…" : "Confirm Delete"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </motion.div>

      {paymentModalOpen && doc && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={() => setPaymentModalOpen(false)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg text-navy">Record Payment</p>
              <button type="button" onClick={() => setPaymentModalOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full text-navy/40 hover:bg-cream-dark">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-2.5">
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="h-10 w-full rounded-lg border border-navy/15 bg-white px-2.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
              >
                <option value="">Select a payment method…</option>
                {(paymentMethods ?? []).map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Amount"
                className="h-10 w-full rounded-lg border border-navy/15 px-2.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
              />
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Reference (if required)"
                className="h-10 w-full rounded-lg border border-navy/15 px-2.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
              />
              {actionError && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{actionError}</p>}
              <button
                type="button"
                onClick={() => void handleRecordPayment()}
                disabled={busyAction === "payment"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busyAction === "payment" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {busyAction === "payment" ? "Recording…" : "Record Payment"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {requestCancelOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={() => setRequestCancelOpen(false)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg text-navy">Request Cancellation</p>
              <button type="button" onClick={() => setRequestCancelOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full text-navy/40 hover:bg-cream-dark">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mb-3 text-xs text-navy/50">Nothing changes until someone with approval rights reviews this.</p>
            <div className="space-y-2.5">
              <label className="block">
                <span className="text-[11px] font-semibold text-navy/50">Reason</span>
                <textarea
                  autoFocus
                  value={requestCancelReason}
                  onChange={(e) => setRequestCancelReason(e.target.value)}
                  placeholder="Why should this invoice be cancelled?"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-navy/15 px-2.5 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-navy/50">Notes (optional)</span>
                <textarea
                  value={requestCancelNotes}
                  onChange={(e) => setRequestCancelNotes(e.target.value)}
                  placeholder="Anything else the approver should know"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-navy/15 px-2.5 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
                />
              </label>
              {actionError && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{actionError}</p>}
              <button
                type="button"
                onClick={() => void handleRequestCancel()}
                disabled={busyAction === "requestCancel"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busyAction === "requestCancel" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {busyAction === "requestCancel" ? "Sending…" : "Send Request"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {requestReturnOpen && doc && (
        <RequestReturnModal
          saleId={saleId}
          currency={doc.currency}
          onClose={() => setRequestReturnOpen(false)}
          onRequested={() => {
            setRequestReturnOpen(false);
            setRequestReturnSent(true);
          }}
        />
      )}

      {convertSaleOpen && doc && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={() => setConvertSaleOpen(false)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg text-navy">Convert to Sale</p>
              <button type="button" onClick={() => setConvertSaleOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full text-navy/40 hover:bg-cream-dark">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mb-3 text-xs text-navy/50">Charging {money(doc.grandTotalCents)}. Leave amount blank to charge the exact total.</p>
            <div className="space-y-2.5">
              <select
                value={convertPaymentMethodId}
                onChange={(e) => setConvertPaymentMethodId(e.target.value)}
                className="h-10 w-full rounded-lg border border-navy/15 bg-white px-2.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
              >
                <option value="">Select a payment method…</option>
                {(paymentMethods ?? []).map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                value={convertAmountReceived}
                onChange={(e) => setConvertAmountReceived(e.target.value)}
                placeholder="Amount received (optional)"
                className="h-10 w-full rounded-lg border border-navy/15 px-2.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
              />
              {actionError && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{actionError}</p>}
              <button
                type="button"
                onClick={() => void handleConvertToSale()}
                disabled={busyAction === "convertSale"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busyAction === "convertSale" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {busyAction === "convertSale" ? "Converting…" : "Confirm Sale"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {convertInvoiceOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={() => setConvertInvoiceOpen(false)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg text-navy">Convert to Invoice</p>
              <button type="button" onClick={() => setConvertInvoiceOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full text-navy/40 hover:bg-cream-dark">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-2.5">
              <label className="block">
                <span className="text-[11px] font-semibold text-navy/50">Due Date</span>
                <input
                  type="date"
                  value={convertDueDate}
                  onChange={(e) => setConvertDueDate(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-navy/15 bg-white px-2.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
                />
              </label>
              {actionError && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{actionError}</p>}
              <button
                type="button"
                onClick={() => void handleConvertToInvoice()}
                disabled={busyAction === "convertInvoice"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busyAction === "convertInvoice" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {busyAction === "convertInvoice" ? "Converting…" : "Confirm Invoice"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export function Row({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className ?? ""}`}>
      <span className={strong ? "font-bold text-navy" : "text-navy/50"}>{label}</span>
      <span className={strong ? "font-bold text-navy" : "font-semibold text-navy"}>{value}</span>
    </div>
  );
}
