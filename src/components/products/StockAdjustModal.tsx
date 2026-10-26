"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ProductListItem, StockAdjustmentMode } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { MAIN_STORE_TYPE, type ProductManageOptions, stockLocations } from "./manage-options";

type AddReason = "purchase" | "return" | "opening_stock";

const MODES: Array<{ value: StockAdjustmentMode; label: string }> = [
  { value: "add", label: "Add" },
  { value: "remove", label: "Remove" },
  { value: "count", label: "Count" },
];

const ADD_REASONS: Array<{ value: AddReason; label: string }> = [
  { value: "purchase", label: "New stock received" },
  { value: "return", label: "Customer return" },
  { value: "opening_stock", label: "Opening stock" },
];

/** Every quick stock change a shop makes in a day, mapped onto DESKTOP's own manual movement types:
 * Add (purchase / return / opening stock), Remove (damage / loss) and Count (a physical stock-take —
 * SERVER records the difference as an "adjustment"). Each lands in the Stock Ledger exactly as if it
 * had been recorded on the POS. The movement id is minted once when the sheet opens, so a retry
 * after a dropped connection can never record the same change twice. */
export function StockAdjustModal({
  product,
  options,
  onClose,
  onSaved,
}: {
  product: ProductListItem;
  options: ProductManageOptions;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const locations = stockLocations(options);
  const [mode, setMode] = useState<StockAdjustmentMode>("add");
  const [locationId, setLocationId] = useState(options.branchScope ?? (locations.length === 1 ? locations[0]!.id : ""));
  const [addReason, setAddReason] = useState<AddReason>("purchase");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const movementId = useRef(`movement_${crypto.randomUUID()}`);

  const currentQuantity = useMemo(() => {
    const location = locations.find((l) => l.id === locationId);
    if (!location) return null;
    if (location.locationType === MAIN_STORE_TYPE) return product.mainStoreQuantity ?? 0;
    return product.storefrontBreakdown.find((s) => s.locationId === locationId)?.quantity ?? 0;
  }, [locations, locationId, product]);

  const qty = Number.parseInt(quantity, 10);
  const preview =
    currentQuantity === null || !Number.isFinite(qty)
      ? null
      : mode === "add"
        ? currentQuantity + qty
        : mode === "remove"
          ? currentQuantity - qty
          : qty;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!locationId) return setError("Choose where the stock is.");
    if (!Number.isFinite(qty) || qty < 0 || (mode !== "count" && qty === 0)) return setError("Enter a quantity.");
    setSaving(true);
    setError(null);
    try {
      const result = await api.recordStockAdjustment({
        id: movementId.current,
        productId: product.id,
        locationId,
        mode,
        addReason: mode === "add" ? addReason : undefined,
        quantity: qty,
        notes: notes.trim() || null,
      });
      onSaved(`${product.name}: ${result.previousQuantity} → ${result.newQuantity}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="Update Stock" subtitle={`${product.name} · ${product.sku}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <SheetError message={error} />

        <div className="grid grid-cols-3 gap-1 rounded-lg bg-cream-dark p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`rounded-md py-2 text-xs font-bold ${mode === m.value ? "bg-white text-navy shadow-sm" : "text-navy/50"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <SheetField label="Location">
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} required className={sheetInputClass}>
            <option value="" disabled>
              Choose a location
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.locationName}
              </option>
            ))}
          </select>
        </SheetField>

        {mode === "add" && (
          <SheetField label="Reason">
            <select value={addReason} onChange={(e) => setAddReason(e.target.value as AddReason)} className={sheetInputClass}>
              {ADD_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </SheetField>
        )}

        <SheetField label={mode === "count" ? "Counted quantity on the shelf" : mode === "add" ? "Quantity to add" : "Quantity damaged / lost"}>
          <input
            autoFocus
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
            required
            className={sheetInputClass}
          />
        </SheetField>

        {currentQuantity !== null && (
          <p className="text-xs text-navy/60">
            Now: <span className="font-bold text-navy">{currentQuantity}</span>
            {preview !== null && (
              <>
                {" "}
                → after: <span className={`font-bold ${preview < 0 ? "text-red" : "text-navy"}`}>{preview}</span>
              </>
            )}
          </p>
        )}

        <SheetField label="Note (optional)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={mode === "remove" ? "e.g. expired, broken" : ""} className={sheetInputClass} />
        </SheetField>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </BottomSheet>
  );
}
