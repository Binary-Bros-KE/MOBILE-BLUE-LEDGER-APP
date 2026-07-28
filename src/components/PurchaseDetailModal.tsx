"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { PurchaseDetail } from "@/lib/types";
import { Row } from "./DocumentDetailModal";

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
 * one), so this is view-only, same bottom-sheet shell as DocumentDetailModal/StatementDetailModal
 * but purpose-built sections (line items table, supplier payments) instead of a receipt layout. */
export function PurchaseDetailModal({ purchaseId, onClose }: { purchaseId: string; onClose: () => void }) {
  const [doc, setDoc] = useState<PurchaseDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getPurchase(purchaseId)
      .then((result) => {
        if (!cancelled) setDoc(result);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Could not load this purchase.");
      });
    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

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

        {doc && (
          <div className="rounded-lg border border-dashed border-navy/15 bg-cream-dark/40 p-4 text-sm">
            <div className="space-y-0.5 text-xs text-navy/70">
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
              <Row label="Tax" value={money(doc.taxAmountCents)} />
              <Row label="Total" value={money(doc.grandTotalCents)} strong />
              <Row label="Paid" value={money(doc.amountPaidCents)} />
            </div>

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
    </div>
  );
}
