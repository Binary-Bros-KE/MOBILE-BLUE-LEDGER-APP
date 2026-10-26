"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents, priceTextToCents } from "@/lib/money";
import type { MobileSupplierBalanceEntry, MobileSupplierWithBalance } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";

const ENTRY_LABELS: Record<string, string> = {
  purchase_received: "Goods received",
  purchase_ordered: "Purchase ordered",
  purchase_cancelled: "Purchase cancelled",
  payment: "Payment",
  manual_adjustment: "Adjustment",
};

type Direction = "less" | "more";

/**
 * A supplier's balance and its history (newest first) — goods received grow it, payments on
 * purchases shrink it. With suppliers.edit there's Adjust Balance: DESKTOP's own manual adjustment,
 * the one entry a person makes directly — an opening balance carried over from an old system, a
 * correction, or money settled outside a purchase. "Reduce" (e.g. a payment outside a purchase) or
 * "Increase" (e.g. an old debt), plus a note saying why. The entry id is minted once per sheet so a
 * retry can't record it twice.
 */
export function SupplierBalanceModal({
  supplier,
  currency,
  canAdjust,
  onClose,
  onChanged,
}: {
  supplier: MobileSupplierWithBalance;
  currency: string;
  canAdjust: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [entries, setEntries] = useState<MobileSupplierBalanceEntry[] | null>(null);
  const [balanceCents, setBalanceCents] = useState(supplier.balanceCents);
  const [adjusting, setAdjusting] = useState(false);
  const [direction, setDirection] = useState<Direction>("less");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entryId = useRef(`supplier_balance_${crypto.randomUUID()}`);
  const money = (cents: number) => formatCents(cents, currency);

  const loadEntries = useCallback(() => {
    api
      .listSupplierBalanceEntries(supplier.id)
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load balance history."));
  }, [supplier.id]);

  useEffect(loadEntries, [loadEntries]);

  async function handleAdjust(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const cents = priceTextToCents(amount);
    if (!cents) return setError("Enter an amount.");
    if (!notes.trim()) return setError("Add a short note saying why — it shows on the supplier's history.");
    setSaving(true);
    setError(null);
    try {
      const result = await api.adjustSupplierBalance(supplier.id, {
        id: entryId.current,
        amountCents: direction === "less" ? -cents : cents,
        notes: notes.trim(),
      });
      setBalanceCents(result.balanceCents);
      entryId.current = `supplier_balance_${crypto.randomUUID()}`;
      setAdjusting(false);
      setAmount("");
      setNotes("");
      loadEntries();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to adjust balance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title={supplier.businessName} subtitle={`${supplier.supplierCode} · ${supplier.phone1}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-cream-dark/60 px-3 py-2.5">
          <span className="text-xs font-semibold text-navy/60">{balanceCents >= 0 ? "We owe them" : "They owe us"}</span>
          <span className={`font-display text-lg ${balanceCents > 0 ? "text-red" : "text-navy"}`}>{money(Math.abs(balanceCents))}</span>
        </div>
        <SheetError message={error} />

        {canAdjust && !adjusting && (
          <button
            type="button"
            onClick={() => setAdjusting(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-navy/20 py-2.5 text-sm font-bold text-navy"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Adjust Balance
          </button>
        )}

        {adjusting && (
          <form onSubmit={handleAdjust} className="space-y-3 rounded-lg border border-navy/15 p-3">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-cream-dark p-1">
              {(
                [
                  ["less", "Reduce (we paid)"],
                  ["more", "Increase (we owe)"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDirection(value)}
                  className={`rounded-md py-2 text-xs font-bold ${direction === value ? "bg-white text-navy shadow-sm" : "text-navy/50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <SheetField label="Amount">
              <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={sheetInputClass} />
            </SheetField>
            <SheetField label="Note">
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={direction === "less" ? "e.g. Paid cash outside a purchase" : "e.g. Balance carried over from old system"}
                className={sheetInputClass}
              />
            </SheetField>
            <p className="text-[11px] text-navy/50">Paying for a specific purchase? Use Pay Supplier on that purchase instead.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAdjusting(false)} className="rounded-lg border border-navy/20 py-2.5 text-xs font-bold text-navy">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-blue py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Save
              </button>
            </div>
          </form>
        )}

        <div>
          <p className="mb-1.5 text-[11px] font-extrabold tracking-wide text-navy/40 uppercase">History</p>
          {!entries && !error && <p className="py-6 text-center text-xs text-navy/40">Loading…</p>}
          {entries && entries.length === 0 && <p className="py-6 text-center text-xs text-navy/40">No balance history yet.</p>}
          <div className="space-y-1.5">
            {(entries ?? []).map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-2 rounded-md border border-navy/10 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-navy">
                    {ENTRY_LABELS[entry.entryType] ?? entry.entryType}
                    {entry.reference ? ` · ${entry.reference}` : ""}
                  </p>
                  <p className="text-navy/40">
                    {new Date(entry.createdAt).toLocaleDateString()}
                    {entry.performedByName ? ` · ${entry.performedByName}` : ""}
                  </p>
                  {entry.notes && <p className="mt-0.5 text-navy/60">{entry.notes}</p>}
                </div>
                <p className={`flex-none font-bold ${entry.amountCents < 0 ? "text-green" : "text-navy"}`}>
                  {entry.amountCents < 0 ? "−" : "+"}
                  {money(Math.abs(entry.amountCents))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
