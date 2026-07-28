"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { ExpenseListItem } from "@/lib/types";
import { Row } from "./DocumentDetailModal";

/** Unlike every other detail modal in this app, this one takes the ALREADY-LOADED row directly
 * (no fetch, no loading state) — Expense is a flat single-payment record with nothing more to fetch
 * beyond what the list already returns (see mobile-expenses-service.ts's own note). No Download/
 * Share either — no PDF/share capability exists for Expenses. */
export function ExpenseDetailModal({ expense, onClose }: { expense: ExpenseListItem; onClose: () => void }) {
  const money = (cents: number) => formatCents(cents, expense.currency);

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
      </motion.div>
    </div>
  );
}
