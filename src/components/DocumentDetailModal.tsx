"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, Share2, X } from "lucide-react";
import { api, ApiError, getShareDownloadUrl } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { taxBreakdownLabel } from "@/lib/tax";
import type { SharedDocument } from "@/lib/types";

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
}: {
  saleId: string;
  kind?: "sale" | "quotation";
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<SharedDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function handleShare(): Promise<void> {
    setSharing(true);
    setActionError(null);
    setNotice(null);
    try {
      const link = await api.createShareLink(kind, saleId, true);
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
                <Row label="Served by" value={`${doc.employeeName} · ${doc.branchName}`} />
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
                <Row label="Total" value={money(doc.grandTotalCents)} strong />
                {doc.balanceDueCents !== null && doc.balanceDueCents > 0 && (
                  <Row label="Balance Due" value={money(doc.balanceDueCents)} strong className="text-red" />
                )}
              </div>

              {doc.taxBreakdown.length > 0 && (
                <>
                  <div className="my-3 border-t border-dashed border-navy/15" />
                  <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-navy/50">Tax Breakdown</p>
                  <div className="space-y-1 text-xs">
                    {doc.taxBreakdown.map((entry) => (
                      <div key={entry.taxType} className="flex justify-between gap-2">
                        <span className="font-bold text-navy">{taxBreakdownLabel(entry.taxType, doc.vatRatePercent)}</span>
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
          </>
        )}
      </motion.div>
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
