"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Ban, Loader2, PackageCheck, Pencil, Send, Wallet, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { taxBreakdownLabel } from "@/lib/tax";
import type { PurchaseDetail } from "@/lib/types";
import { Row } from "./DocumentDetailModal";
import { PaySupplierModal } from "./purchases/PaySupplierModal";
import { ReceiveGoodsModal } from "./purchases/ReceiveGoodsModal";

const STATUS_TONE: Record<string, string> = {
  draft: "border-navy/30 text-navy/50",
  ordered: "border-blue text-blue",
  partially_received: "border-gold text-gold-text",
  received: "border-green text-green",
  cancelled: "border-red text-red",
};

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

/** No Download/Share buttons — confirmed no PDF/share capability exists for Purchases anywhere in
 * this app (a Purchase's only "document" on DESKTOP is a locally-attached file, not a generated
 * one). Same bottom-sheet shell as DocumentDetailModal/StatementDetailModal but purpose-built
 * sections (line items, supplier payments). With purchases.edit (`canEdit`) it also carries the
 * lifecycle actions DESKTOP has: Place Order / Cancel on a draft, Receive Goods while anything is
 * outstanding, Pay Supplier while something received is unpaid. `onChanged` lets the list refresh. */
export function PurchaseDetailModal({
  purchaseId,
  canEdit = false,
  onClose,
  onChanged,
  onEditDraft,
}: {
  purchaseId: string;
  canEdit?: boolean;
  onClose: () => void;
  onChanged?: () => void;
  /** Re-open this draft in the purchase form (the tab closes this modal first). */
  onEditDraft?: (purchase: PurchaseDetail) => void;
}) {
  const [doc, setDoc] = useState<PurchaseDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"receive" | "pay" | null>(null);
  const [busy, setBusy] = useState<"order" | "cancel" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getPurchase(purchaseId)
      .then(setDoc)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load this purchase."));
  }, [purchaseId]);

  useEffect(load, [load]);

  function afterChange(): void {
    setSheet(null);
    load();
    onChanged?.();
  }

  /** Cancel takes two taps (arm, then confirm) — same pattern as the Employees tab's Suspend. */
  async function runAction(action: "order" | "cancel"): Promise<void> {
    if (action === "cancel" && !confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    setBusy(action);
    setActionError(null);
    try {
      if (action === "order") await api.markPurchaseOrdered(purchaseId);
      else await api.cancelPurchase(purchaseId);
      setConfirmCancel(false);
      afterChange();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update this purchase.");
    } finally {
      setBusy(null);
    }
  }

  const canOrder = canEdit && doc?.status === "draft";
  const canCancel = canEdit && (doc?.status === "draft" || doc?.status === "ordered");
  const canReceive = canEdit && (doc?.status === "ordered" || doc?.status === "partially_received");
  const canPay = canEdit && doc !== null && doc.status !== "cancelled" && doc.balanceDueCents > 0;

  const money = (cents: number) => (doc ? formatCents(cents, doc.currency) : "-");

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
              <p className="font-display text-lg text-navy">{doc?.purchaseNumber ?? "Purchase"}</p>
              {doc && (
                <span
                  className={`rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${STATUS_TONE[doc.status] ?? "border-navy/30 text-navy/50"}`}
                >
                  {formatStatus(doc.status)}
                </span>
              )}
            </div>
            {doc && <p className="text-xs text-navy/50">{doc.supplierName}</p>}
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

        {doc && (canOrder || canReceive || canPay || canCancel) && (
          <div className="mb-3 space-y-2">
            {actionError && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{actionError}</p>}
            <div className="grid grid-cols-2 gap-2">
              {canOrder && (
                <ActionButton icon={busy === "order" ? Loader2 : Send} label="Place Order" onClick={() => void runAction("order")} primary spinning={busy === "order"} />
              )}
              {canOrder && onEditDraft && <ActionButton icon={Pencil} label="Edit Draft" onClick={() => onEditDraft(doc)} />}
              {canReceive && <ActionButton icon={PackageCheck} label="Receive Goods" onClick={() => setSheet("receive")} primary />}
              {canPay && <ActionButton icon={Wallet} label="Pay Supplier" onClick={() => setSheet("pay")} primary={!canReceive} />}
              {canCancel && (
                <ActionButton
                  icon={busy === "cancel" ? Loader2 : Ban}
                  label={confirmCancel ? "Tap again" : "Cancel"}
                  onClick={() => void runAction("cancel")}
                  danger
                  spinning={busy === "cancel"}
                />
              )}
            </div>
          </div>
        )}

        {doc && (
          <div className="rounded-lg border border-dashed border-navy/15 bg-cream-dark/40 p-4 text-sm">
            <div className="space-y-0.5 text-xs text-navy/70">
              {doc.origin && (
                <>
                  <Row
                    label="Requested"
                    value={`${doc.origin.requisitionNumber} · ${doc.origin.requestedByName} · ${new Date(doc.origin.requestedAt).toLocaleDateString()}`}
                  />
                  {doc.origin.approvedByName && (
                    <Row
                      label="Approved"
                      value={`${doc.origin.approvedByName}${doc.origin.approvedAt ? ` · ${new Date(doc.origin.approvedAt).toLocaleDateString()}` : ""}`}
                    />
                  )}
                </>
              )}
              <Row label="Storefront" value={doc.locationName} />
              {doc.supplierPhone && <Row label="Supplier Phone" value={doc.supplierPhone} />}
              {doc.supplierInvoiceNumber && <Row label="Supplier Invoice #" value={doc.supplierInvoiceNumber} />}
              {doc.orderedAt && <Row label="Ordered" value={new Date(doc.orderedAt).toLocaleDateString()} />}
              {doc.receivedAt && <Row label="Received" value={new Date(doc.receivedAt).toLocaleDateString()} />}
            </div>

            <div className="my-3 border-t border-dashed border-navy/15" />
            <div className="space-y-2">
              {doc.items.map((item, index) => (
                <div key={index} className="flex items-start justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-navy">{item.productName}</p>
                    <p className="text-navy/40">
                      {item.receivedQuantity}/{item.orderedQuantity} received · {money(item.unitCostCents)} each
                    </p>
                  </div>
                  <p className="flex-none font-bold text-navy">{money(item.lineTotalCents)}</p>
                </div>
              ))}
            </div>

            {doc.notes && (
              <>
                <div className="my-3 border-t border-dashed border-navy/15" />
                <p className="text-xs text-navy/70">{doc.notes}</p>
              </>
            )}

            <div className="my-3 border-t border-dashed border-navy/15" />
            <div className="space-y-1 text-xs">
              <Row label="Subtotal" value={money(doc.subtotalCents)} />
              {doc.discountAmountCents > 0 && <Row label="Discount" value={`-${money(doc.discountAmountCents)}`} />}
              {doc.shippingCostCents > 0 && <Row label="Shipping Fee" value={money(doc.shippingCostCents)} />}
              <Row label="Total" value={money(doc.grandTotalCents)} strong />
              {doc.receivedValueCents > 0 && doc.status !== "received" && <Row label="Received so far" value={money(doc.receivedValueCents)} />}
              <Row label="Paid" value={money(doc.amountPaidCents)} />
              {doc.balanceDueCents > 0 && <Row label="Due now" value={money(doc.balanceDueCents)} strong />}
            </div>

            {doc.taxBreakdown.length > 0 && (
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

            {doc.payments.length > 0 && (
              <>
                <div className="my-3 border-t border-dashed border-navy/15" />
                <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-navy/50">Supplier Payments</p>
                <div className="space-y-2">
                  {doc.payments.map((payment, index) => (
                    <div key={index} className="flex items-start justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-navy">{payment.paidByName}</p>
                        <p className="text-navy/40">
                          {new Date(payment.paidAt).toLocaleDateString()} · {payment.paymentMethodName}
                          {payment.reference ? ` · ${payment.reference}` : ""}
                        </p>
                      </div>
                      <p className="flex-none font-bold text-navy">{money(payment.amountCents)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>

      {/* Siblings of the animated panel, not children — a fixed-position sheet inside a transformed
          parent would be positioned relative to it. stopPropagation keeps a tap on a sheet's own
          backdrop from also closing this purchase underneath. */}
      <div onClick={(e) => e.stopPropagation()}>
        {sheet === "receive" && doc && <ReceiveGoodsModal purchase={doc} onClose={() => setSheet(null)} onSaved={afterChange} />}
        {sheet === "pay" && doc && <PaySupplierModal purchase={doc} onClose={() => setSheet(null)} onSaved={afterChange} />}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  primary,
  danger,
  spinning,
}: {
  icon: typeof X;
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  spinning?: boolean;
}) {
  const tone = danger ? "border-red/40 text-red" : primary ? "border-blue bg-blue text-white" : "border-navy/15 text-navy";
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-bold ${tone}`}>
      <Icon className={`size-3.5 ${spinning ? "animate-spin" : ""}`} aria-hidden="true" />
      {label}
    </button>
  );
}
