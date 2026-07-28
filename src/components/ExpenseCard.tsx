"use client";

import { Store, Wallet } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { ExpenseListItem } from "@/lib/types";

export function ExpenseCard({ expense, onSelect }: { expense: ExpenseListItem; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 rounded-lg bg-white p-4 text-left shadow-sm">
      <div className="grid size-11 flex-none place-items-center rounded-full bg-navy text-white">
        <Wallet className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-bold text-navy">{expense.categoryName}</p>
          <p className="flex-none font-display text-sm text-navy">{formatCents(expense.amountCents, expense.currency)}</p>
        </div>
        <p className="truncate text-xs text-navy/50">
          {new Date(expense.expenseDate).toLocaleDateString()}
          {expense.description ? ` · ${expense.description}` : ""}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-bold text-blue">
          <Store className="size-3.5 flex-none" aria-hidden="true" />
          {expense.locationName}
        </p>
      </div>
    </button>
  );
}
