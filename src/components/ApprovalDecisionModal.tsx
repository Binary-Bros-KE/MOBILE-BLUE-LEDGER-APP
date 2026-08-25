"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Store, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { InvoiceCancellationApprovalItem } from "@/lib/types";

/** Approve (restocks + cancels the invoice) or reject (leaves everything untouched) one pending
 * cancellation request — the manager-side half of DocumentDetailModal's "Request Cancellation".
 * Both decisions accept an optional note, same shape SERVER's mobileCancellationDecisionSchema
 * expects. */
export function ApprovalDecisionModal({
  item,
  onClose,
  onDecided,
}: {
  item: InvoiceCancellationApprovalItem;
  onClose: () => void;
  onDecided: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject"): Promise<void> {
    setBusyAction(decision);
    setError(null);
    try {
      if (decision === "approve") {
        await api.approveInvoiceCancellation(item.id, notes.trim() || undefined);
      } else {
        await api.rejectInvoiceCancellation(item.id, notes.trim() || undefined);
      }
      onDecided();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That action failed — check your connection and try again.");
    } finally {
      setBusyAction(null);
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
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="font-display text-lg text-navy">{item.invoiceNumber ?? "Invoice"}</p>
            <p className="flex items-center gap-1 text-xs font-bold text-blue">
              <Store className="size-3.5 flex-none" aria-hidden="true" />
              {item.locationName}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-lg border border-dashed border-navy/15 bg-cream-dark/40 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-navy/50">Total</span>
            <span className="font-bold text-navy">{formatCents(item.saleGrandTotalCents, item.currency)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-navy/50">Requested by</span>
            <span className="font-semibold text-navy">{item.requestedByName}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-navy/50">Requested</span>
            <span className="font-semibold text-navy">{new Date(item.requestedAt).toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-[11px] font-semibold text-navy/50">Reason</p>
          <p className="mt-0.5 text-sm font-semibold text-navy">{item.reason}</p>
          {item.notes && (
            <>
              <p className="mt-2 text-[11px] font-semibold text-navy/50">Notes</p>
              <p className="mt-0.5 text-sm text-navy/70">{item.notes}</p>
            </>
          )}
        </div>

        <label className="mt-3 block">
          <span className="text-[11px] font-semibold text-navy/50">Your notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes on your decision"
            rows={2}
            className="mt-1 w-full rounded-lg border border-navy/15 px-2.5 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
          />
        </label>

        {error && <p className="mt-3 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void decide("reject")}
            disabled={busyAction !== null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-navy/15 bg-white py-3 text-sm font-bold text-navy disabled:opacity-50"
          >
            {busyAction === "reject" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busyAction === "reject" ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            onClick={() => void decide("approve")}
            disabled={busyAction !== null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {busyAction === "approve" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busyAction === "approve" ? "Approving…" : "Approve Cancellation"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
