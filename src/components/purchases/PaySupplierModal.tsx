"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { centsToPriceText, formatCents, priceTextToCents } from "@/lib/money";
import type { PaymentMethodOption, PurchaseDetail } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";

/** Pay the supplier against what's been RECEIVED so far (plus the shipping fee once anything has
 * arrived) — DESKTOP's rule: you never pay for goods that haven't come in. The amount starts at the
 * full balance due; lower it for a part-payment. */
export function PaySupplierModal({ purchase, onClose, onSaved }: { purchase: PurchaseDetail; onClose: () => void; onSaved: () => void }) {
  const [methods, setMethods] = useState<PaymentMethodOption[] | null>(null);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState(centsToPriceText(purchase.balanceDueCents));
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listPaymentMethods()
      .then(setMethods)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load payment methods."));
  }, []);

  const method = methods?.find((m) => m.id === methodId) ?? null;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const amountCents = priceTextToCents(amount);
    if (!methodId) return setError("Choose how you paid.");
    if (!amountCents || amountCents <= 0) return setError("Enter an amount.");
    if (amountCents > purchase.balanceDueCents) return setError(`That's more than the ${formatCents(purchase.balanceDueCents, purchase.currency)} due.`);
    if (method?.requiresReference && !reference.trim()) return setError(`${method.name} needs a reference.`);

    setSaving(true);
    setError(null);
    try {
      await api.recordPurchasePayment(purchase.id, {
        paymentMethodId: methodId,
        // Exactly the balance → let SERVER compute it (DESKTOP's "mark paid"), immune to rounding.
        amountCents: amountCents === purchase.balanceDueCents ? undefined : amountCents,
        reference: reference.trim() || null,
        notes: null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="Pay Supplier" subtitle={`${purchase.supplierName} · ${formatCents(purchase.balanceDueCents, purchase.currency)} due`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <SheetError message={error} />
        <SheetField label="Paid with">
          <select value={methodId} onChange={(e) => setMethodId(e.target.value)} className={sheetInputClass}>
            <option value="" disabled>
              Choose a payment method
            </option>
            {(methods ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </SheetField>
        <SheetField label="Amount">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={sheetInputClass} />
        </SheetField>
        <SheetField label={method?.requiresReference ? "Reference" : "Reference (optional)"}>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. M-Pesa code" className={sheetInputClass} />
        </SheetField>
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Record Payment"}
        </button>
      </form>
    </BottomSheet>
  );
}
