"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, Loader2, Minus, Plus, RefreshCw, Smartphone, XCircle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { billing, MIN_TOPUP_KES, owedPeriods, type PaymentSchedule } from "@/lib/billing";
import { formatCents } from "@/lib/money";
import { BottomSheet, SheetField, sheetInputClass } from "../BottomSheet";

type Step = "form" | "sending" | "waiting" | "success" | "failed";

/**
 * Pay Blue Ledger (DESKTOP's PayNowModal, phone-sized): "pay" settles N periods from the next one due;
 * "topup" adds any amount to the prepaid balance, which then pays each period as it falls due
 * (SERVER subscription-wallet-service.ts). M-Pesa is an STK push to the phone; card opens Pesapal's
 * secure page in a new tab. Either way the result is polled from SERVER until it settles.
 */
export function PayFlowSheet({
  mode,
  schedule,
  onClose,
  onPaid,
}: {
  mode: "pay" | "topup";
  schedule: PaymentSchedule;
  onClose: () => void;
  onPaid: () => void;
}) {
  const isTopUp = mode === "topup";
  const price = schedule.pricePerPeriodCents ?? 0;
  const periodNoun = schedule.billingCycle === "YEARLY" ? "year" : "month";
  const owedCount = owedPeriods(schedule).length;

  const [method, setMethod] = useState<"mpesa" | "card">("mpesa");
  const [phone, setPhone] = useState("");
  const [periodCount, setPeriodCount] = useState(Math.max(1, owedCount));
  const [amountText, setAmountText] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const pending = useRef<{ kind: "mpesa" | "card"; id: string } | null>(null);

  const amountKes = Math.floor(Number(amountText) || 0);
  const totalCents = isTopUp ? amountKes * 100 : price * periodCount;

  function settle(status: string, statusMessage: string): void {
    if (status === "pending") return;
    pending.current = null;
    if (status === "success") {
      setStep("success");
      setMessage(isTopUp ? "Top-up received — it's on your balance and pays each payment as it falls due." : "Paid — thank you.");
      onPaid();
    } else {
      setStep("failed");
      setMessage(statusMessage);
    }
  }

  useEffect(() => {
    if (step !== "waiting") return undefined;
    const interval = setInterval(() => {
      const current = pending.current;
      if (!current) return;
      const poll = current.kind === "mpesa" ? billing.mpesaStatus(current.id) : billing.cardStatus(current.id);
      poll.then((result) => settle(result.status, result.message)).catch(() => undefined);
    }, 3000);
    return () => clearInterval(interval);
    // settle only reads stable values and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function start(): Promise<void> {
    setMessage(null);
    if (isTopUp && amountKes < MIN_TOPUP_KES) return setMessage(`Enter an amount of at least ${MIN_TOPUP_KES}.`);
    if (method === "mpesa" && phone.trim().length < 9) return setMessage("Enter the M-Pesa phone number.");
    setStep("sending");
    try {
      if (method === "mpesa") {
        const result = isTopUp ? await billing.topUpByMpesa(phone.trim(), amountKes) : await billing.payByMpesa(phone.trim(), periodCount);
        pending.current = { kind: "mpesa", id: result.checkoutRequestId };
        setMessage("Check your phone and enter your M-Pesa PIN…");
      } else {
        const result = isTopUp ? await billing.topUpByCard(amountKes) : await billing.payByCard(periodCount);
        pending.current = { kind: "card", id: result.orderTrackingId };
        window.open(result.redirectUrl, "_blank", "noopener");
        setMessage("Finish paying on Pesapal's page — this updates on its own.");
      }
      setStep("waiting");
    } catch (err) {
      setStep("form");
      setMessage(err instanceof ApiError ? err.message : "Couldn't start the payment.");
    }
  }

  async function checkNow(): Promise<void> {
    const current = pending.current;
    if (!current) return;
    setChecking(true);
    try {
      const result = current.kind === "mpesa" ? await billing.mpesaCheck(current.id) : await billing.cardCheck(current.id);
      settle(result.status, result.message);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't check right now.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <BottomSheet
      title={isTopUp ? "Top Up Balance" : "Pay Now"}
      subtitle={isTopUp ? `Each ${periodNoun}'s payment is taken from your balance when it falls due.` : `${formatCents(price, schedule.currency)} a ${periodNoun}`}
      onClose={onClose}
    >
      {step === "form" || step === "sending" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "mpesa", label: "M-Pesa", icon: Smartphone },
                { key: "card", label: "Card / PayPal", icon: CreditCard },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-xs font-bold ${method === key ? "border-blue bg-blue/10 text-blue" : "border-navy/15 text-navy"}`}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {isTopUp ? (
            <>
              <SheetField label={`Amount (${schedule.currency})`}>
                <input inputMode="numeric" value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 6000" className={sheetInputClass} />
              </SheetField>
              {price > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[1, 3, 6, 12].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setAmountText(String(Math.ceil((price * count) / 100)))}
                      className="rounded-full border border-navy/15 px-2.5 py-1 text-[11px] font-bold text-navy"
                    >
                      {count} {periodNoun}
                      {count === 1 ? "" : "s"}
                    </button>
                  ))}
                </div>
              )}
              {price > 0 && amountKes > 0 && (
                <p className="text-[11px] font-semibold text-navy/50">
                  {Math.floor((amountKes * 100) / price) > 0
                    ? `Covers ${Math.floor((amountKes * 100) / price)} ${periodNoun}${Math.floor((amountKes * 100) / price) === 1 ? "" : "s"}.`
                    : `Less than one ${periodNoun} — it stays on your balance until there's enough.`}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-navy/10 px-3 py-2">
              <span className="text-xs font-bold text-navy/60">
                {periodNoun === "year" ? "Years" : "Months"}
                {owedCount > 0 ? ` (${owedCount} owed)` : ""}
              </span>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Fewer" onClick={() => setPeriodCount((n) => Math.max(1, n - 1))} className="grid size-8 place-items-center rounded-full border border-navy/15 text-navy">
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span className="w-6 text-center text-sm font-extrabold text-navy">{periodCount}</span>
                <button type="button" aria-label="More" onClick={() => setPeriodCount((n) => Math.min(24, n + 1))} className="grid size-8 place-items-center rounded-full border border-navy/15 text-navy">
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {method === "mpesa" && (
            <SheetField label="M-Pesa phone number">
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0712 345 678" className={sheetInputClass} />
            </SheetField>
          )}

          <div className="flex items-center justify-between rounded-lg bg-navy px-4 py-3 text-white">
            <span className="text-[11px] font-bold tracking-wide text-white/70 uppercase">Total</span>
            <span className="font-display text-lg">{formatCents(totalCents, schedule.currency)}</span>
          </div>

          {message && <p className="text-xs font-semibold text-red">{message}</p>}

          <button
            type="button"
            disabled={step === "sending"}
            onClick={() => void start()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {step === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : method === "card" ? <ExternalLink className="size-4" aria-hidden="true" /> : null}
            {method === "mpesa" ? "Send M-Pesa prompt" : "Continue to secure checkout"}
          </button>
        </div>
      ) : step === "waiting" ? (
        <div className="space-y-3 py-2">
          <p className="flex items-center gap-2 text-sm font-bold text-blue">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {message}
          </p>
          <button
            type="button"
            disabled={checking}
            onClick={() => void checkNow()}
            className="flex items-center gap-1.5 rounded-lg border border-navy/15 px-3 py-2 text-xs font-bold text-navy disabled:opacity-50"
          >
            {checking ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
            Taking long? Check now
          </button>
        </div>
      ) : (
        <div className="space-y-3 py-2">
          <p className={`flex items-start gap-2 text-sm font-bold ${step === "success" ? "text-green" : "text-red"}`}>
            {step === "success" ? <CheckCircle2 className="mt-0.5 size-4 flex-none" aria-hidden="true" /> : <XCircle className="mt-0.5 size-4 flex-none" aria-hidden="true" />}
            {message}
          </p>
          <button
            type="button"
            onClick={step === "success" ? onClose : () => setStep("form")}
            className="w-full rounded-lg bg-navy py-3 text-sm font-bold text-white"
          >
            {step === "success" ? "Done" : "Try again"}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
