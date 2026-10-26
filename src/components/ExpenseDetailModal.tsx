"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Archive, Loader2, Pencil, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { ExpenseListItem } from "@/lib/types";
import { Row } from "./DocumentDetailModal";

/** Unlike every other detail modal in this app, this one takes the ALREADY-LOADED row directly
 * (no fetch, no loading state) — Expense is a flat single-payment record with nothing more to fetch
 * beyond what the list already returns (see mobile-expenses-service.ts's own note). No Download/
 * Share either — no PDF/share capability exists for Expenses. `onEdit`/`canArchive` add DESKTOP's
 * Edit and Archive actions (expenses.edit / expenses.delete); archiving is the only removal once an
 * expense exists in the cloud, so it takes two taps. */
export function ExpenseDetailModal({
  expense,
  onClose,
  onEdit,
  canArchive = false,
  onArchived,
}: {
  expense: ExpenseListItem;
  onClose: () => void;
  onEdit?: () => void;
  canArchive?: boolean;
  onArchived?: () => void;
}) {
  const money = (cents: number) => formatCents(cents, expense.currency);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleArchive(): Promise<void> {
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    setArchiving(true);
    setActionError(null);
    try {
      await api.archiveExpense(expense.id);
      onArchived?.();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not archive this expense.");
      setArchiving(false);
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
        className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-display text-lg text-navy">{expense.categoryName}</p>
            <p className="text-xs text-navy/50">{expense.expenseNumber}</p>
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

        <div className="rounded-lg border border-dashed border-navy/15 bg-cream-dark/40 p-4 text-sm">
          <div className="space-y-1 text-xs text-navy/70">
            <Row label="Date" value={new Date(expense.expenseDate).toLocaleDateString()} />
            <Row label="Storefront" value={expense.locationName} />
            <Row label="Payment Method" value={expense.paymentMethodName ?? "-"} />
            {expense.reference && <Row label="Reference" value={expense.reference} />}
          </div>

          {expense.description && (
            <>
              <div className="my-3 border-t border-dashed border-navy/15" />
              <p className="text-xs text-navy/70">{expense.description}</p>
            </>
          )}

          <div className="my-3 border-t border-dashed border-navy/15" />
          <Row label="Amount" value={money(expense.amountCents)} strong />
        </div>

        {(onEdit || canArchive) && (
          <div className="mt-3 space-y-2">
            {actionError && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{actionError}</p>}
            <div className="grid grid-cols-2 gap-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-navy/15 py-2.5 text-xs font-bold text-navy"
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Edit
                </button>
              )}
              {canArchive && (
                <button
                  type="button"
                  disabled={archiving}
                  onClick={() => void handleArchive()}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-bold disabled:opacity-50 ${
                    confirmArchive ? "border-red bg-red text-white" : "border-red/40 text-red"
                  }`}
                >
                  {archiving ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Archive className="size-3.5" aria-hidden="true" />}
                  {confirmArchive ? "Tap again to archive" : "Archive"}
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
