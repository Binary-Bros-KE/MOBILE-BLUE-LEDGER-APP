"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDown, Loader2, Search, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ProductListItem } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { MAIN_STORE_TYPE, type ProductManageOptions, stockLocations } from "./manage-options";

type Line = { productId: string; name: string; quantity: string };

/**
 * Move stock between storefronts and the Main Store — several products in one go. Recorded exactly
 * as DESKTOP records a transfer (a "transfer out" at the source and a "transfer in" at the
 * destination per product), so both stock ledgers show it. A branch-scoped employee can only send
 * from their own storefront or the Main Store (SERVER enforces the same). The transfer id is minted
 * once per sheet, so a retry can't move the stock twice.
 */
export function StockTransferModal({
  products,
  options,
  onClose,
  onSaved,
}: {
  products: ProductListItem[];
  options: ProductManageOptions;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const sources = stockLocations(options);
  const destinations = options.locations;
  const [fromId, setFromId] = useState(options.branchScope ?? (sources.length === 1 ? sources[0]!.id : ""));
  const [toId, setToId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transferId = useRef(`transfer_${crypto.randomUUID()}`);

  const fromLocation = options.locations.find((l) => l.id === fromId) ?? null;
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  /** What's on hand at the source — the Main Store figure or that storefront's own row. */
  function availableAtSource(productId: string): number | null {
    const product = productById.get(productId);
    if (!product || !fromLocation) return null;
    if (fromLocation.locationType === MAIN_STORE_TYPE) return product.mainStoreQuantity ?? 0;
    return product.storefrontBreakdown.find((s) => s.locationId === fromLocation.id)?.quantity ?? 0;
  }

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const added = new Set(lines.map((l) => l.productId));
    return products
      .filter((p) => p.trackStock && p.status !== "inactive" && !added.has(p.id))
      .filter((p) => `${p.name} ${p.sku} ${p.barcode ?? ""}`.toLowerCase().includes(term))
      .slice(0, 6);
  }, [products, search, lines]);

  async function handleSubmit(): Promise<void> {
    if (!fromId || !toId) return setError("Choose where the stock comes from and where it goes.");
    if (fromId === toId) return setError("Choose two different locations.");
    if (lines.length === 0) return setError("Add at least one product.");
    const items = [];
    for (const line of lines) {
      const quantity = Number.parseInt(line.quantity, 10);
      if (!quantity || quantity <= 0) return setError(`Enter how many ${line.name} to move.`);
      items.push({ productId: line.productId, quantity });
    }
    setSaving(true);
    setError(null);
    try {
      await api.recordStockTransfer({ id: transferId.current, fromLocationId: fromId, toLocationId: toId, items, notes: notes.trim() || null });
      const toName = options.locations.find((l) => l.id === toId)?.locationName ?? "destination";
      onSaved(`Moved ${items.length} product${items.length === 1 ? "" : "s"} from ${fromLocation?.locationName ?? "source"} to ${toName}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to transfer stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="Transfer Stock" subtitle="Move stock between locations." onClose={onClose}>
      <div className="space-y-3">
        <SheetError message={error} />
        <SheetField label="From">
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} disabled={sources.length === 1} className={sheetInputClass}>
            <option value="" disabled>
              Choose a location
            </option>
            {sources.map((l) => (
              <option key={l.id} value={l.id}>
                {l.locationName}
              </option>
            ))}
          </select>
        </SheetField>
        <div className="flex justify-center text-navy/30">
          <ArrowDown className="size-4" aria-hidden="true" />
        </div>
        <SheetField label="To">
          <select value={toId} onChange={(e) => setToId(e.target.value)} className={sheetInputClass}>
            <option value="" disabled>
              Choose a location
            </option>
            {destinations
              .filter((l) => l.id !== fromId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.locationName}
                </option>
              ))}
          </select>
        </SheetField>

        <div>
          <p className="text-[11px] font-semibold text-navy/50">Products</p>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search to add a product…" className={`${sheetInputClass} mt-0 pl-9`} />
          </div>
          {matches.length > 0 && (
            <div className="mt-1 divide-y divide-navy/10 rounded-lg border border-navy/15">
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setLines((prev) => [...prev, { productId: p.id, name: p.name, quantity: "1" }]);
                    setSearch("");
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-cream-dark"
                >
                  <span className="truncate font-bold text-navy">{p.name}</span>
                  {fromLocation && <span className="flex-none text-navy/40">{availableAtSource(p.id)} here</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.map((line) => {
          const available = availableAtSource(line.productId);
          return (
            <div key={line.productId} className="flex items-center gap-2 rounded-lg border border-navy/15 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy">{line.name}</p>
                {available !== null && <p className="text-[11px] text-navy/50">{available} available to move</p>}
              </div>
              {/* Fixed-width wrapper — sheetInputClass is w-full, see ReceiveGoodsModal. */}
              <div className="w-16 flex-none">
                <input
                  inputMode="numeric"
                  aria-label={`Quantity of ${line.name}`}
                  value={line.quantity}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    const capped = available !== null && digits && Number(digits) > available ? String(available) : digits;
                    setLines((prev) => prev.map((l) => (l.productId === line.productId ? { ...l, quantity: capped } : l)));
                  }}
                  className={`${sheetInputClass} mt-0 text-center`}
                />
              </div>
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((l) => l.productId !== line.productId))}
                aria-label={`Remove ${line.name}`}
                className="text-navy/30 hover:text-red"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}

        <SheetField label="Note (optional)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Weekly restock" className={sheetInputClass} />
        </SheetField>

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSubmit()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? "Moving…" : "Transfer Stock"}
        </button>
      </div>
    </BottomSheet>
  );
}
