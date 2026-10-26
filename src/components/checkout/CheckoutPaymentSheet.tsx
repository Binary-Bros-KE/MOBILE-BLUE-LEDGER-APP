"use client";

import { useEffect, useState } from "react";
import { BookUser, Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { centsToPriceText, formatCents, priceTextToCents } from "@/lib/money";
import type { PaymentMethodOption } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { MpesaPromptPanel } from "./MpesaPromptPanel";

/** DESKTOP's own seeded M-Pesa payment method code. */
const MPESA_CODE = "MPESA";

export type CheckoutPaymentEntry = { paymentMethodId: string; amountCents: number; reference: string };

type Row = { paymentMethodId: string; amount: string; reference: string };

/** YYYY-MM-DD in the phone's own timezone, `days` from today. */
function localDatePlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Round-up targets for the quick-cash buttons — the notes a customer actually hands over. */
function quickCashAmounts(totalCents: number): number[] {
  const steps = [5_000, 10_000, 50_000, 100_000];
  const amounts = new Set<number>([totalCents]);
  for (const step of steps) {
    const rounded = Math.ceil(totalCents / step) * step;
    if (rounded > totalCents) amounts.add(rounded);
    if (amounts.size >= 4) break;
  }
  return [...amounts].sort((a, b) => a - b);
}

/**
 * Take payment for the cart. One row by default (the full total, first payment method); "Split" adds
 * more rows for a customer paying with two or more methods — the same rules SERVER enforces (port of
 * DESKTOP's buildSplitPayments): together they must cover the total, and any change can only come
 * back out of a method that needs no reference (cash). With a customer on the sale, "Put on account"
 * turns the cart into an invoice instead — DESKTOP's way of selling on credit — collected later from
 * the Customers tab. An M-Pesa row can send an STK prompt straight to the customer's phone when the
 * storefront has a Till set up; the receipt number then fills the row's reference by itself.
 */
export function CheckoutPaymentSheet({
  grandTotalCents,
  currency,
  paymentMethods,
  customerName,
  customerPhone,
  locationId,
  canPutOnAccount,
  submitting,
  error,
  onCharge,
  onPutOnAccount,
  onClose,
}: {
  grandTotalCents: number;
  currency: string;
  paymentMethods: PaymentMethodOption[];
  /** null for a walk-in sale — "Put on account" needs a real customer. */
  customerName: string | null;
  /** Pre-fills the M-Pesa prompt's phone number. */
  customerPhone: string | null;
  locationId: string;
  canPutOnAccount: boolean;
  submitting: boolean;
  error: string | null;
  onCharge: (payments: CheckoutPaymentEntry[]) => void;
  onPutOnAccount: (dueDate: string) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([{ paymentMethodId: paymentMethods[0]?.id ?? "", amount: centsToPriceText(grandTotalCents), reference: "" }]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [onAccount, setOnAccount] = useState(false);
  const [dueDate, setDueDate] = useState(localDatePlus(30));
  const money = (cents: number) => formatCents(cents, currency);
  const [mpesaConfigured, setMpesaConfigured] = useState(false);

  useEffect(() => {
    api
      .isMpesaConfigured(locationId)
      .then((r) => setMpesaConfigured(r.configured))
      .catch(() => setMpesaConfigured(false));
  }, [locationId]);

  const methodOf = (id: string) => paymentMethods.find((m) => m.id === id) ?? null;
  const tenderedCents = rows.reduce((sum, r) => sum + (priceTextToCents(r.amount) ?? 0), 0);
  const remainingCents = grandTotalCents - tenderedCents;
  const changeCents = -remainingCents;
  // Change can only come out of a cash-type (no-reference) row — same rule SERVER applies.
  const cashTendered = rows.filter((r) => !methodOf(r.paymentMethodId)?.requiresReference).reduce((sum, r) => sum + (priceTextToCents(r.amount) ?? 0), 0);
  const changeNotPossible = changeCents > 0 && cashTendered < changeCents;

  function updateRow(index: number, patch: Partial<Row>): void {
    setLocalError(null);
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addSplitRow(): void {
    const used = new Set(rows.map((r) => r.paymentMethodId));
    const next = paymentMethods.find((m) => !used.has(m.id)) ?? paymentMethods[0];
    setRows((prev) => [...prev, { paymentMethodId: next?.id ?? "", amount: remainingCents > 0 ? centsToPriceText(remainingCents) : "", reference: "" }]);
  }

  function handleCharge(): void {
    const entries: CheckoutPaymentEntry[] = [];
    for (const row of rows) {
      const method = methodOf(row.paymentMethodId);
      const amountCents = priceTextToCents(row.amount);
      if (!method) return setLocalError("Choose a payment method for every row.");
      if (!amountCents || amountCents <= 0) return setLocalError(`Enter the amount paid by ${method.name}.`);
      if (method.requiresReference && !row.reference.trim()) return setLocalError(`${method.name} needs a reference.`);
      entries.push({ paymentMethodId: method.id, amountCents, reference: row.reference.trim() });
    }
    if (remainingCents > 0) return setLocalError(`Still ${money(remainingCents)} to pay.`);
    if (changeNotPossible) return setLocalError("Change can only be given from a cash payment — lower the other amounts.");
    onCharge(entries);
  }

  return (
    <BottomSheet title={`Total ${money(grandTotalCents)}`} subtitle={customerName ?? "Walk-in Customer"} onClose={onClose}>
      {onAccount ? (
        <div className="space-y-3">
          <SheetError message={error} />
          <p className="text-sm text-navy/70">
            Charge {money(grandTotalCents)} to <span className="font-bold text-navy">{customerName}</span>&apos;s account. An invoice is created and you collect
            payment later from the Customers tab.
          </p>
          <SheetField label="Payment due by">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={sheetInputClass} />
          </SheetField>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setOnAccount(false)} className="rounded-lg border border-navy/20 py-3 text-sm font-bold text-navy">
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => onPutOnAccount(dueDate)}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Put on Account
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <SheetError message={localError ?? error} />

          {rows.map((row, index) => {
            const method = methodOf(row.paymentMethodId);
            const isCash = method !== null && !method.requiresReference;
            return (
              <div key={index} className="space-y-2 rounded-lg border border-navy/15 p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <SheetField label={rows.length > 1 ? `Payment ${index + 1}` : "Paid with"}>
                      <select value={row.paymentMethodId} onChange={(e) => updateRow(index, { paymentMethodId: e.target.value })} className={sheetInputClass}>
                        {paymentMethods.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </SheetField>
                  </div>
                  <div className="w-28">
                    <SheetField label="Amount">
                      <input inputMode="decimal" value={row.amount} onChange={(e) => updateRow(index, { amount: e.target.value })} className={`${sheetInputClass} text-right`} />
                    </SheetField>
                  </div>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remove this payment"
                      className="grid size-[38px] flex-none place-items-center text-navy/30 hover:text-red"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                {method?.code === MPESA_CODE && mpesaConfigured && (
                  <MpesaPromptPanel
                    amountCents={priceTextToCents(row.amount) ?? 0}
                    currency={currency}
                    locationId={locationId}
                    defaultPhone={customerPhone ?? ""}
                    onPaid={(receipt) => updateRow(index, { reference: receipt })}
                  />
                )}
                {method?.requiresReference && (
                  <input
                    value={row.reference}
                    onChange={(e) => updateRow(index, { reference: e.target.value })}
                    placeholder={`${method.name} reference`}
                    className={`${sheetInputClass} mt-0`}
                  />
                )}
                {isCash && rows.length === 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {quickCashAmounts(grandTotalCents).map((cents) => (
                      <button
                        key={cents}
                        type="button"
                        onClick={() => updateRow(index, { amount: centsToPriceText(cents) })}
                        className="rounded-full border border-navy/15 px-3 py-1 text-xs font-bold text-navy hover:bg-cream-dark"
                      >
                        {cents === grandTotalCents ? "Exact" : money(cents)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {rows.length < 4 && paymentMethods.length > 1 && (
            <button type="button" onClick={addSplitRow} className="flex items-center gap-1 text-xs font-bold text-blue">
              <Plus className="size-3.5" aria-hidden="true" />
              Split with another method
            </button>
          )}

          <div className="flex items-center justify-between border-t border-dashed border-navy/15 pt-2 text-sm">
            {remainingCents > 0 ? (
              <>
                <span className="text-navy/60">Still to pay</span>
                <span className="font-display text-red">{money(remainingCents)}</span>
              </>
            ) : (
              <>
                <span className="text-navy/60">Change</span>
                <span className={`font-display ${changeNotPossible ? "text-red" : "text-green"}`}>{money(Math.max(0, changeCents))}</span>
              </>
            )}
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleCharge}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Completing sale…" : `Complete Sale · ${money(grandTotalCents)}`}
          </button>

          {canPutOnAccount && (
            <button
              type="button"
              disabled={!customerName}
              onClick={() => setOnAccount(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-navy/20 py-2.5 text-xs font-bold text-navy disabled:opacity-40"
            >
              <BookUser className="size-4" aria-hidden="true" />
              {customerName ? "Put on customer's account (pay later)" : "Choose a customer to sell on account"}
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
