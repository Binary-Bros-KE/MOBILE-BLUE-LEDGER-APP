"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { PurchaseDetail } from "@/lib/types";
import { BottomSheet, SheetError, sheetInputClass } from "../BottomSheet";

/** Receive some or all of what's still outstanding, line by line — repeatable until everything has
 * arrived (DESKTOP's receivePurchaseGoods). Each line starts filled with its full remaining quantity
 * so "everything came" is a single tap; clear or lower a line for a partial delivery. Stock is added
 * at the purchase's destination and the supplier balance grows by what this batch is worth. */
export function ReceiveGoodsModal({ purchase, onClose, onSaved }: { purchase: PurchaseDetail; onClose: () => void; onSaved: () => void }) {
  const outstanding = purchase.items.filter((item) => item.orderedQuantity > item.receivedQuantity);
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(outstanding.map((item) => [item.id, String(item.orderedQuantity - item.receivedQuantity)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const items = outstanding
      .map((item) => ({ purchaseItemId: item.id, receivingQuantity: Number.parseInt(quantities[item.id] ?? "", 10) || 0 }))
      .filter((entry) => entry.receivingQuantity > 0);
    if (items.length === 0) return setError("Enter at least one quantity to receive.");

    setSaving(true);
    setError(null);
    try {
      await api.receivePurchaseGoods(purchase.id, items);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to receive goods.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="Receive Goods" subtitle={`${purchase.purchaseNumber} · into ${purchase.locationName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <SheetError message={error} />
        {outstanding.map((item) => {
          const remaining = item.orderedQuantity - item.receivedQuantity;
          return (
            <div key={item.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy">{item.productName}</p>
                <p className="text-[11px] text-navy/50">
                  {remaining} of {item.orderedQuantity} still to come
                </p>
              </div>
              <input
                inputMode="numeric"
                aria-label={`Quantity of ${item.productName} received`}
                value={quantities[item.id] ?? ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  const capped = digits && Number(digits) > remaining ? String(remaining) : digits;
                  setQuantities((prev) => ({ ...prev, [item.id]: capped }));
                }}
                className={`${sheetInputClass} mt-0 w-20 text-center`}
              />
            </div>
          );
        })}
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? "Receiving…" : "Receive Into Stock"}
        </button>
      </form>
    </BottomSheet>
  );
}
