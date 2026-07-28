"use client";

import { ArrowDownLeft, ArrowUpRight, Store } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { TransactionRow as TransactionRowType } from "@/lib/types";

const STATUS_TONE: Record<TransactionRowType["status"], string> = {
  complete: "border-green text-green",
  failed: "border-red text-red",
};

const DIRECTION_TONE: Record<TransactionRowType["direction"], string> = {
  in: "border-green text-green",
  out: "border-red text-red",
};

/** A payment-ledger row, not a document card — DESKTOP's own Transactions tab has no per-row detail
 * view either (see mobile-transactions-service.ts's own notes), so this is a plain static row rather
 * than a tappable button.
 *
 * The transaction code, time, and payment method are the fields a user actually verifies a payment
 * against — per explicit user feedback, none of them may ever be clipped with an ellipsis, so this
 * deliberately uses `break-all`/`break-words` instead of `truncate` throughout, even though it means
 * a long M-Pesa code or reference can make the row taller. */
export function TransactionRow({ transaction }: { transaction: TransactionRowType }) {
  const DirectionIcon = transaction.direction === "in" ? ArrowDownLeft : ArrowUpRight;
  const directionTone = DIRECTION_TONE[transaction.direction];
  const statusTone = STATUS_TONE[transaction.status];

  return (
    <div className="flex w-full items-start gap-3 rounded-lg bg-white p-4 shadow-sm">
      <div className={`grid size-11 flex-none place-items-center rounded-full border-2 border-dashed ${directionTone} bg-cream-dark/60`}>
        <DirectionIcon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="break-all font-bold text-navy">{transaction.transactionCode}</p>
          <p className="flex-none font-display text-sm text-navy">{formatCents(transaction.amountCents, transaction.currency)}</p>
        </div>
        <p className="break-words text-xs text-navy/50">
          {new Date(transaction.occurredAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ·{" "}
          {transaction.processedByName}
        </p>
        <p className="mt-0.5 flex items-center gap-1 break-words text-xs font-bold text-blue">
          <Store className="size-3.5 flex-none" aria-hidden="true" />
          {transaction.locationName}
        </p>
        {transaction.paymentMethodName && <p className="mt-0.5 break-words text-xs text-navy/50">{transaction.paymentMethodName}</p>}
        {transaction.partyName && (
          <p className="mt-0.5 break-words text-xs text-navy/70">
            <span className="font-bold">{transaction.partyLabel}:</span> {transaction.partyName}
          </p>
        )}
      </div>
      <div className="flex flex-none flex-col items-end gap-1">
        <span className={`rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${directionTone}`}>
          {transaction.direction}
        </span>
        {transaction.status === "failed" && (
          <span className={`rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${statusTone}`}>
            failed
          </span>
        )}
      </div>
    </div>
  );
}
