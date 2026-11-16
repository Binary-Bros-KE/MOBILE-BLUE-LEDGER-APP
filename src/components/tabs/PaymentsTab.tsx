"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, PiggyBank, Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ApiError } from "@/lib/api";
import { billing, owedPeriods, type BillingPayment, type PaymentSchedule, type Wallet } from "@/lib/billing";
import { computeBalanceReminder } from "@/lib/billing-warnings";
import { formatCents } from "@/lib/money";
import { PayFlowSheet } from "../billing/PayFlowSheet";

const PERIOD_TONE: Record<string, string> = {
  paid: "border-green/30 bg-green/10 text-green",
  overdue: "border-red/30 bg-red/10 text-red",
  due: "border-gold/40 bg-gold/10 text-gold-text",
  future: "border-navy/10 bg-white text-navy/40",
};

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Super Admin only (navigation.ts): this business's own Blue Ledger subscription — balance, what's
 * owed, Pay Now / Top Up, the paid-periods calendar, recent payments and the balance's statement.
 * Same SERVER data DESKTOP's Payments page shows. */
export function PaymentsTab({ licenseStatus }: { licenseStatus: string | null }) {
  const [schedule, setSchedule] = useState<PaymentSchedule | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState<"pay" | "topup" | null>(null);

  const load = useCallback(() => {
    Promise.all([billing.schedule(), billing.wallet(), billing.payments()])
      .then(([s, w, p]) => {
        setSchedule(s);
        setWallet(w);
        setPayments(p.recentPayments);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your payments."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-navy/40">
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }
  if (error || !schedule || !wallet) {
    return <p className="m-4 rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error ?? "Could not load your payments."}</p>;
  }

  const currency = schedule.currency;
  const recurring = schedule.pricePerPeriodCents !== null && schedule.billingCycle !== "ONCE";
  const periodNoun = schedule.billingCycle === "YEARLY" ? "year" : "month";
  const owed = owedPeriods(schedule);
  const reminder = computeBalanceReminder({
    licenseStatus: licenseStatus ?? "active",
    subscriptionType: null,
    nextDueDate: wallet.nextDueDate,
    walletBalanceCents: wallet.balanceCents,
    pricePerPeriodCents: wallet.pricePerPeriodCents,
  });

  return (
    <div className="space-y-4 p-4 pb-28">
      {!recurring ? (
        <p className="rounded-lg border border-dashed border-navy/20 bg-white px-4 py-3 text-sm font-semibold text-navy/60">Your plan has no recurring payment.</p>
      ) : (
        <>
          <section className="rounded-xl bg-navy p-5 text-white">
            <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-white/60 uppercase">
              <PiggyBank className="size-3.5" aria-hidden="true" />
              Balance
            </p>
            <p className="mt-1 font-display text-3xl">{formatCents(wallet.balanceCents, currency)}</p>
            <p className="mt-1 text-xs text-white/70">
              Covers {wallet.periodsCovered} {periodNoun}
              {wallet.periodsCovered === 1 ? "" : "s"} at {formatCents(wallet.pricePerPeriodCents ?? 0, currency)} a {periodNoun}
            </p>
            <p className="mt-3 text-xs text-white/70">
              Next payment {wallet.nextDueDate ? shortDate(wallet.nextDueDate) : "—"} ·{" "}
              <span className={wallet.nextDueUncovered ? "text-gold" : "text-green"}>{wallet.nextDueUncovered ? "not covered" : "covered by your balance"}</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setFlow("topup")} className="flex items-center justify-center gap-1.5 rounded-lg bg-white py-2.5 text-sm font-bold text-navy">
                <Plus className="size-4" aria-hidden="true" />
                Top Up
              </button>
              <button type="button" onClick={() => setFlow("pay")} className="rounded-lg border border-white/30 py-2.5 text-sm font-bold text-white">
                Pay Now
              </button>
            </div>
          </section>

          {owed.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-red/30 bg-red/10 px-3.5 py-3 text-xs font-semibold text-red">
              <AlertTriangle className="mt-0.5 size-4 flex-none" aria-hidden="true" />
              <span>
                {owed.some((e) => e.status === "overdue") ? "Overdue" : "Due now"}: {owed.map((e) => e.label).join(", ")} —{" "}
                {formatCents((schedule.pricePerPeriodCents ?? 0) * owed.length, currency)}.
              </span>
            </div>
          )}
          {reminder && owed.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3.5 py-3 text-xs font-semibold text-navy">
              <AlertTriangle className="mt-0.5 size-4 flex-none text-gold-text" aria-hidden="true" />
              <span>
                Your balance won&apos;t cover the {formatCents(reminder.priceCents, currency)} due {shortDate(reminder.dueDate)} — top up at least{" "}
                {formatCents(reminder.shortByCents, currency)}.
              </span>
            </div>
          )}

          <section className="rounded-xl bg-white p-4">
            <p className="text-[11px] font-bold tracking-wide text-navy/50 uppercase">Payment calendar</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {schedule.periods.map((period) => (
                <span key={period.key} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${PERIOD_TONE[period.status]}`}>
                  {period.label}
                </span>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="rounded-xl bg-white p-4">
        <p className="text-[11px] font-bold tracking-wide text-navy/50 uppercase">Recent payments</p>
        {payments.length === 0 ? (
          <p className="mt-2 text-xs text-navy/50">No payments yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-navy/10">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-bold text-navy">{payment.billingPeriod}</p>
                  <p className="text-[11px] text-navy/50">
                    {payment.paymentMethod} · {shortDate(payment.paymentDate)}
                  </p>
                </div>
                <p className="text-sm font-bold text-navy">{formatCents(payment.amountCents, payment.currency)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {wallet.entries.length > 0 && (
        <section className="rounded-xl bg-white p-4">
          <p className="text-[11px] font-bold tracking-wide text-navy/50 uppercase">Balance history</p>
          <div className="mt-2 divide-y divide-navy/10">
            {wallet.entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-navy">
                    {entry.kind === "DEDUCTION" ? `Paid ${entry.billingPeriod ?? ""}` : entry.note && entry.note !== "Top-up" ? entry.note : entry.kind === "TOPUP" ? "Top-up" : "Adjustment"}
                  </p>
                  <p className="text-[11px] text-navy/50">
                    {shortDate(entry.createdAt)}
                    {entry.reference ? ` · ${entry.reference}` : ""}
                  </p>
                </div>
                <div className="flex-none text-right">
                  <p className={`text-sm font-bold ${entry.amountCents < 0 ? "text-navy" : "text-green"}`}>
                    {entry.amountCents < 0 ? "−" : "+"}
                    {formatCents(Math.abs(entry.amountCents), currency)}
                  </p>
                  <p className="text-[11px] text-navy/40">Balance {formatCents(entry.balanceAfterCents, currency)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {flow && (
          <PayFlowSheet
            mode={flow}
            schedule={schedule}
            onClose={() => setFlow(null)}
            onPaid={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
