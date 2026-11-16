"use client";

import { AlertTriangle } from "lucide-react";
import { computeBalanceReminder, computeGraceStatus, type BillingStatus } from "@/lib/billing-warnings";
import { formatCents } from "@/lib/money";

/**
 * The overdue / short-balance warning DESKTOP shows at login, for everyone signed in to the phone
 * (from /mobile/me's billing status). A Super Admin can tap through to Payments.
 */
export function BillingNotice({ billing, currency, onOpenPayments }: { billing: BillingStatus | null | undefined; currency: string; onOpenPayments?: () => void }) {
  const grace = computeGraceStatus(billing);
  const reminder = grace.state === "current" ? computeBalanceReminder(billing) : null;
  if (grace.state === "current" && !reminder) return null;

  const text =
    grace.state === "grace"
      ? `Your Blue Ledger payment is overdue — ${grace.daysRemaining} day${grace.daysRemaining === 1 ? "" : "s"} left before ${grace.hardLock ? "the system locks" : "cloud sync stops"}.`
      : grace.state === "expired"
        ? `Your Blue Ledger payment is overdue — ${grace.hardLock ? "the system is locked" : "cloud sync has stopped"} until it's paid.`
        : `Your balance won't cover the payment due in ${reminder!.daysUntilDue} day${reminder!.daysUntilDue === 1 ? "" : "s"} — top up at least ${formatCents(reminder!.shortByCents, currency)}.`;

  return (
    <button
      type="button"
      onClick={onOpenPayments}
      disabled={!onOpenPayments}
      className={`flex w-full items-start gap-2 px-4 py-2.5 text-left text-xs font-semibold ${grace.state === "current" ? "bg-gold/15 text-navy" : "bg-red/10 text-red"}`}
    >
      <AlertTriangle className="mt-0.5 size-4 flex-none" aria-hidden="true" />
      <span>
        {text}
        {onOpenPayments && <span className="ml-1 font-bold underline underline-offset-2">Pay</span>}
      </span>
    </button>
  );
}
