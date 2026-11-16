"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import { ApiError, LICENSE_KEY_STORAGE_KEY } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { billing, owedPeriods, type PaymentSchedule, type Wallet } from "@/lib/billing";
import { computeBalanceReminder } from "@/lib/billing-warnings";
import { formatCents } from "@/lib/money";
import { PayFlowSheet } from "@/components/billing/PayFlowSheet";

export default function LoginPage() {
  const { status, login } = useAuth();
  const router = useRouter();

  const [licenseKey, setLicenseKey] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Once a license key has been entered successfully on this phone, it's remembered — a user
  // should never have to type it a second time. "showLicenseField" only reopens if they
  // deliberately ask to switch businesses.
  const [showLicenseField, setShowLicenseField] = useState(false);
  // The business's Blue Ledger subscription, by license key (no session needed): the same overdue /
  // short-balance warnings DESKTOP shows at login, and a way to pay when sign-in is refused because
  // the license was locked for non-payment.
  const [schedule, setSchedule] = useState<PaymentSchedule | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [lockedForPayment, setLockedForPayment] = useState(false);
  const [payFlow, setPayFlow] = useState<"pay" | "topup" | null>(null);
  const [paidNotice, setPaidNotice] = useState(false);

  function loadBilling(): void {
    Promise.all([billing.schedule(), billing.wallet()])
      .then(([s, w]) => {
        setSchedule(s);
        setWallet(w);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    // Read-on-mount — the react.dev-endorsed pattern; this rule is stricter than the docs here.
    const stored = localStorage.getItem(LICENSE_KEY_STORAGE_KEY);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLicenseKey(stored);
      loadBilling();
    } else {
      setShowLicenseField(true);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(licenseKey, employeeCode, pin);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the API. Check your connection.");
      if (err instanceof ApiError && err.status === 403 && err.message.includes("PAYMENT_OVERDUE")) {
        setLockedForPayment(true);
        setPaidNotice(false);
        loadBilling();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-11 place-items-center text-base font-extrabold text-navy">
            <img src="/BLUE_LEDGER.png" alt="BLUE LEDGER" />
          </span>
          <h1 className="mt-2 font-display text-xl text-navy">BLUE LEDGER</h1>
          <p className="text-xs font-semibold tracking-wide text-navy/50 uppercase">Owner App</p>
        </div>

        {(() => {
          const owed = owedPeriods(schedule);
          const reminder = wallet
            ? computeBalanceReminder({
                licenseStatus: "active",
                subscriptionType: null,
                nextDueDate: wallet.nextDueDate,
                walletBalanceCents: wallet.balanceCents,
                pricePerPeriodCents: wallet.pricePerPeriodCents,
              })
            : null;
          if (paidNotice) {
            return <p className="mt-6 rounded border border-green/30 bg-green/10 px-4 py-2.5 text-sm font-semibold text-green">Payment received — sign in again.</p>;
          }
          if (!lockedForPayment && owed.length === 0 && !reminder) return null;
          return (
            <div className={`mt-6 rounded border px-4 py-3 text-xs font-semibold ${owed.length > 0 || lockedForPayment ? "border-red/30 bg-red/10 text-red" : "border-gold/40 bg-gold/10 text-navy"}`}>
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 flex-none" aria-hidden="true" />
                <span>
                  {owed.length > 0
                    ? `You have ${owed.length} overdue payment${owed.length === 1 ? "" : "s"} (${owed.map((e) => e.label).join(", ")}). Please settle ${owed.length === 1 ? "it" : "them"} to avoid any inconvenience.`
                    : lockedForPayment
                      ? "This business is locked until its Blue Ledger payment is made."
                      : `Your balance won't cover the payment due in ${reminder!.daysUntilDue} day${reminder!.daysUntilDue === 1 ? "" : "s"} — top up at least ${formatCents(reminder!.shortByCents, wallet!.currency)}.`}
                </span>
              </p>
              {schedule && schedule.pricePerPeriodCents !== null && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPayFlow("pay")} className="rounded bg-blue py-2 text-xs font-bold text-white">
                    Pay Now
                  </button>
                  <button type="button" onClick={() => setPayFlow("topup")} className="rounded border border-navy/20 bg-white py-2 text-xs font-bold text-navy">
                    Top Up
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && (
            <div className="rounded border border-red/30 bg-red/10 px-4 py-2.5 text-sm font-semibold text-red">
              {error}
            </div>
          )}

          {showLicenseField ? (
            <label className="block">
              <span className="text-[11px] font-bold tracking-wide text-navy/60 uppercase">License Key</span>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                required
                autoComplete="off"
                placeholder="From your Business Profile screen"
                className="mt-1.5 w-full rounded border border-navy/20 px-3 py-2.5 text-sm outline-none focus:border-blue"
              />
            </label>
          ) : (
            <p className="text-center text-[11px] text-navy/40">
              Signing in to this business.{" "}
              <button
                type="button"
                onClick={() => {
                  setShowLicenseField(true);
                  setLicenseKey("");
                }}
                className="font-semibold text-blue underline underline-offset-2"
              >
                Not you?
              </button>
            </p>
          )}

          <label className="block">
            <span className="text-[11px] font-bold tracking-wide text-navy/60 uppercase">Employee Code</span>
            <input
              type="text"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required
              autoComplete="username"
              className="mt-1.5 w-full rounded border border-navy/20 px-3 py-2.5 text-sm outline-none focus:border-blue"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold tracking-wide text-navy/60 uppercase">PIN</span>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1.5 w-full rounded border border-navy/20 px-3 py-2.5 text-center text-lg tracking-[0.5em] outline-none focus:border-blue"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue py-3 text-xs font-bold tracking-wide text-white transition hover:bg-blue-press disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
            {submitting ? "SIGNING IN…" : "SIGN IN"}
          </button>

          <p className="text-center text-[11px] text-navy/50">
            Same employee code and PIN you use on the till. This app is read-only.
          </p>
        </form>

        <AnimatePresence>
          {payFlow && schedule && (
            <PayFlowSheet
              mode={payFlow}
              schedule={schedule}
              onClose={() => setPayFlow(null)}
              onPaid={() => {
                setError(null);
                setLockedForPayment(false);
                setPaidNotice(true);
                loadBilling();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
