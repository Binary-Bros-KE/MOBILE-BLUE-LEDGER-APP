"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MobileLocation, ProductListItem } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";

type Line = {
  key: string;
  productId: string | null;
  itemName: string;
  sku: string | null;
  quantity: string;
  notes: string;
};

/**
 * New purchase requisition — what needs buying, for which storefront. Lines come from the catalog
 * or are typed as free text for something the shop doesn't stock yet (an approver links those to a
 * product before converting). No costs or suppliers here: those are the approver's call when it
 * becomes a purchase. The id is minted once when the sheet opens, so a retry can't create it twice.
 */
export function NewRequisitionModal({
  storefronts,
  onClose,
  onCreated,
}: {
  /** Only offered when the viewer has no storefront of their own (an unassigned Super Admin). */
  storefronts: MobileLocation[] | null;
  onClose: () => void;
  onCreated: (requisitionNumber: string) => void;
}) {
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [storefrontId, setStorefrontId] = useState(storefronts?.length === 1 ? storefronts[0]!.id : "");
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [freeText, setFreeText] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requisitionId = useRef(`preq_${crypto.randomUUID()}`);

  useEffect(() => {
    api
      .listProducts()
      .then(setProducts)
      // Free-text items still work without the catalog.
      .catch(() => setProducts([]));
  }, []);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!products || !term) return [];
    const inList = new Set(lines.map((l) => l.productId));
    return products
      .filter((p) => !inList.has(p.id) && `${p.name} ${p.sku} ${p.barcode ?? ""}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [products, search, lines]);

  function addProduct(product: ProductListItem): void {
    setLines((prev) => [...prev, { key: product.id, productId: product.id, itemName: product.name, sku: product.sku, quantity: "1", notes: "" }]);
    setSearch("");
  }

  function addFreeText(): void {
    const name = freeText.trim();
    if (!name) return;
    setLines((prev) => [...prev, { key: `free_${Date.now()}_${prev.length}`, productId: null, itemName: name, sku: null, quantity: "1", notes: "" }]);
    setFreeText("");
  }

  function updateLine(key: string, patch: Partial<Line>): void {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit(): Promise<void> {
    if (storefronts && storefronts.length > 0 && !storefrontId) return setError("Choose which storefront this is for.");
    if (lines.length === 0) return setError("Add at least one item.");
    const items = [];
    for (const line of lines) {
      const quantity = Number.parseInt(line.quantity, 10);
      if (!quantity || quantity <= 0) return setError(`Enter a quantity for ${line.itemName}.`);
      items.push({ productId: line.productId, itemName: line.itemName, quantity, notes: line.notes.trim() || null });
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api.createRequisition({
        id: requisitionId.current,
        storefrontId: storefronts ? storefrontId || null : null,
        notes: notes.trim() || null,
        items,
      });
      onCreated(result.requisitionNumber);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send requisition.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="New Requisition" subtitle="Ask for stock to be bought — a manager approves it into a purchase." onClose={onClose}>
      <div className="space-y-3">
        <SheetError message={error} />

        {storefronts && storefronts.length > 0 && (
          <SheetField label="For storefront">
            <select value={storefrontId} onChange={(e) => setStorefrontId(e.target.value)} className={sheetInputClass}>
              <option value="" disabled>
                Choose a storefront
              </option>
              {storefronts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.locationName}
                </option>
              ))}
            </select>
          </SheetField>
        )}

        <div>
          <p className="text-[11px] font-semibold text-navy/50">From the catalog</p>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={products ? "Search products…" : "Loading products…"}
              className={`${sheetInputClass} mt-0 pl-9`}
            />
          </div>
          {matches.length > 0 && (
            <div className="mt-1 divide-y divide-navy/10 rounded-lg border border-navy/15">
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-cream-dark"
                >
                  <span className="truncate font-bold text-navy">{p.name}</span>
                  <span className="flex-none text-navy/40">{p.sku}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold text-navy/50">Not in the catalog</p>
          <div className="mt-1 flex gap-2">
            <input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addFreeText();
                }
              }}
              placeholder="e.g. Samsung A15 charger"
              className={`${sheetInputClass} mt-0 min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={addFreeText}
              disabled={!freeText.trim()}
              aria-label="Add item"
              className="grid size-[38px] flex-none place-items-center rounded-lg bg-blue text-white disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {lines.map((line) => (
          <div key={line.key} className="rounded-lg border border-navy/15 p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy">{line.itemName}</p>
                <p className={`text-[11px] ${line.productId ? "text-navy/40" : "font-bold text-blue"}`}>
                  {line.productId ? line.sku : "New item — not in catalog"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                aria-label={`Remove ${line.itemName}`}
                className="text-navy/30 hover:text-red"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-[5rem_1fr] gap-2">
              <SheetField label="Qty">
                <input
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value.replace(/\D/g, "") })}
                  className={sheetInputClass}
                />
              </SheetField>
              <SheetField label="Note (optional)">
                <input
                  value={line.notes}
                  onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                  placeholder="Colour, size, brand…"
                  className={sheetInputClass}
                />
              </SheetField>
            </div>
          </div>
        ))}

        <SheetField label="Reason / notes (optional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={sheetInputClass} />
        </SheetField>

        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Send for Approval
        </button>
      </div>
    </BottomSheet>
  );
}
