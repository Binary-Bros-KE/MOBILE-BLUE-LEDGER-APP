"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { sheetInputClass } from "../BottomSheet";

type State = "idle" | "sending" | "awaiting" | "success" | "error";

/** How often to re-read the transaction while the customer enters their PIN. Passive reads only —
 * SERVER never calls Safaricom on these; "Check now" is the one that actively queries. */
const POLL_MS = 3_000;

/**
 * Sends an M-Pesa STK prompt for this payment row's amount to the customer's phone, then waits for
 * the result — the same flow as DESKTOP's Checkout (same SERVER functions; Till credentials never
 * leave the server). On success the M-Pesa receipt number becomes the row's reference automatically,
 * so the sale records exactly which transaction paid for it. Only rendered when the storefront has a
 * Till configured.
 */
export function MpesaPromptPanel({
  amountCents,
  currency,
  locationId,
  defaultPhone,
  onPaid,
}: {
  amountCents: number;
  currency: string;
  locationId: string;
  defaultPhone: string;
  onPaid: (receiptNumber: string) => void;
}) {
  const [phone, setPhone] = useState(defaultPhone);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  function applyStatus(result: { status: string; message: string; mpesaReceiptNumber: string | null }): void {
    if (result.status === "success") {
      setState("success");
      setMessage(result.message);
      if (result.mpesaReceiptNumber) onPaid(result.mpesaReceiptNumber);
    } else if (result.status !== "pending") {
      setState("error");
      setMessage(result.message);
    }
  }

  useEffect(() => {
    if (state !== "awaiting" || !checkoutRequestId) return;
    const timer = window.setInterval(() => {
      api
        .getMpesaStatus(checkoutRequestId)
        .then(applyStatus)
        .catch(() => {
          // A missed poll just waits for the next one.
        });
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // applyStatus only reads setters and onPaid — restarting the timer on every render isn't wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, checkoutRequestId]);

  async function send(): Promise<void> {
    if (amountCents <= 0) {
      setState("error");
      setMessage("Enter the amount first.");
      return;
    }
    setState("sending");
    setMessage(null);
    try {
      const result = await api.sendMpesaPrompt({ locationId, phone: phone.trim(), amountCents });
      setCheckoutRequestId(result.checkoutRequestId);
      setState("awaiting");
      setMessage("Prompt sent — waiting for the customer to enter their M-Pesa PIN…");
    } catch (err) {
      setState("error");
      setMessage(err instanceof ApiError ? err.message : "Couldn't send the M-Pesa prompt.");
    }
  }

  async function checkNow(): Promise<void> {
    if (!checkoutRequestId) return;
    setChecking(true);
    try {
      applyStatus(await api.checkMpesaStatusNow(checkoutRequestId));
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't check the status.");
    } finally {
      setChecking(false);
    }
  }

  if (state === "success") {
    return (
      <p className="flex items-center gap-1.5 rounded-md bg-green/10 px-2.5 py-2 text-xs font-bold text-green">
        <CheckCircle2 className="size-4 flex-none" aria-hidden="true" />
        {message ?? "Paid."}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-md bg-green/5 p-2.5">
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Customer's M-Pesa number"
          disabled={state === "sending" || state === "awaiting"}
          className={`${sheetInputClass} mt-0 flex-1`}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={state === "sending" || state === "awaiting" || phone.trim().length < 9}
          className="flex flex-none items-center gap-1.5 rounded-lg bg-green px-3 text-xs font-bold text-white disabled:opacity-50"
        >
          {state === "sending" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Smartphone className="size-3.5" aria-hidden="true" />}
          {state === "error" ? "Resend" : `Prompt ${formatCents(amountCents, currency)}`}
        </button>
      </div>
      {message && <p className={`text-[11px] font-semibold ${state === "error" ? "text-red" : "text-navy/60"}`}>{message}</p>}
      {state === "awaiting" && (
        <button type="button" onClick={() => void checkNow()} disabled={checking} className="flex items-center gap-1 text-[11px] font-bold text-blue disabled:opacity-50">
          {checking && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
          Taking a while? Check now
        </button>
      )}
    </div>
  );
}
