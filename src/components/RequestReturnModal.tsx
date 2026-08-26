"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Undo2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { MobileReturnableItem } from "@/lib/types";

/** A cashier's request to return some or all of the items on a completed receipt — mirrors
 * DESKTOP's own ReceiptsRoute.tsx return modal exactly: per-line quantity picker capped at what's
 * still eligible (sold minus already-APPROVED returns), a required reason, optional notes. Nothing
 * is restocked or refunded here — that only happens once a manager approves the request from
 * DESKTOP (see SERVER's requestSaleReturn doc comment); mobile deliberately has no approval UI for
 * returns at all, request-only, same "sales":"edit" permission the button itself is gated by. */
export function RequestReturnModal({
  saleId,
  currency,
  onClose,
  onRequested,
}: {
  saleId: string;
  currency: string;
  onClose: () => void;
  onRequested: () => void;
}) {
  const [items, setItems] = useState<MobileReturnableItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSaleReturnableItems(saleId)
      .then(setItems)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load this receipt's items."));
  }, [saleId]);

  function setQuantity(saleItemId: string, value: string): void {
    setQuantities((prev) => ({ ...prev, [saleItemId]: value }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!reason.trim()) {
      setSubmitError("A reason is required.");
      return;
    }
    const requestItems = Object.entries(quantities)
      .map(([saleItemId, raw]) => ({ saleItemId, quantity: Math.floor(Number(raw)) }))
      .filter((entry) => entry.quantity > 0);
    if (requestItems.length === 0) {
      setSubmitError("Select at least one item to return.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.requestSaleReturn(saleId, { reason: reason.trim(), notes: notes.trim() || undefined, items: requestItems });
      onRequested();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to submit the return request — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <p className="flex items-center gap-1.5 font-display text-lg text-navy">
              <Undo2 className="size-4 text-blue" aria-hidden="true" />
              Request Return
            </p>
            <p className="text-xs text-navy/50">Select the items and quantities being returned. A manager must approve before stock is restocked.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loadError && <p className="mb-3 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{loadError}</p>}
          {!items && !loadError && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}

          {items && (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.saleItemId} className="rounded-lg border border-navy/10 bg-cream-dark/40 p-2.5">
                    <p className="truncate text-sm font-bold text-navy">{item.productName}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-navy/50">
                        Sold {item.quantitySold} · {item.remainingQuantity} eligible for return
                      </p>
                      <input
                        type="number"
                        min={0}
                        max={item.remainingQuantity}
                        step={1}
                        disabled={item.remainingQuantity <= 0}
                        value={quantities[item.saleItemId] ?? ""}
                        onChange={(e) => setQuantity(item.saleItemId, e.target.value)}
                        placeholder="0"
                        className="h-8 w-16 flex-none rounded-md border border-navy/15 px-2 text-right text-xs font-semibold text-navy focus:border-blue focus:outline-none disabled:bg-navy/5 disabled:text-navy/30"
                      />
                    </div>
                    <p className="mt-0.5 text-[10px] text-navy/40">{formatCents(item.unitPriceCents, currency)} each</p>
                  </div>
                ))}
              </div>

              <label className="block">
                <span className="text-[11px] font-semibold text-navy/50">Reason</span>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Wrong size, customer changed mind"
                  className="mt-1 w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-navy/50">Notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
                />
              </label>

              {submitError && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{submitError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {submitting ? "Submitting…" : "Submit Return Request"}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
