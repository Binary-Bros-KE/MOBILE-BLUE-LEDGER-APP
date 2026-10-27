"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents, priceTextToCents } from "@/lib/money";
import type { MobileLocation, MobileSupplier, ProductListItem } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { QuickCreateSupplierModal } from "../QuickCreateSupplierModal";

type Line = {
  productId: string;
  name: string;
  sku: string;
  taxType: string;
  quantity: string;
  unitCost: string;
  sellingPrice: string;
};

/**
 * New purchase order — supplier, where the goods will be received, and the product lines (quantity,
 * unit cost, optional new selling price). "Place Order" commits it straight away: SERVER re-prices
 * the products and books any shipping cost as an expense, exactly like DESKTOP. "Save Draft" changes
 * nothing yet. Stock only moves later, on Receive Goods. Line tax is computed server-side from each
 * product's own tax category — the total shown here is cost × quantity only. The purchase id is
 * minted once when the sheet opens, so a retry after a dropped connection can't create it twice.
 */
export function NewPurchaseModal({
  locations,
  currency,
  onClose,
  onCreated,
}: {
  /** Where this viewer may receive goods (already narrowed for a branch-scoped employee). */
  locations: MobileLocation[];
  currency: string;
  onClose: () => void;
  onCreated: (purchaseId: string) => void;
}) {
  const [suppliers, setSuppliers] = useState<MobileSupplier[] | null>(null);
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState(locations.length === 1 ? locations[0]!.id : "");
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [shippingFee, setShippingFee] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [notes, setNotes] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [saving, setSaving] = useState<"draft" | "ordered" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const purchaseId = useRef(`purchase_${crypto.randomUUID()}`);

  useEffect(() => {
    Promise.all([api.listSuppliers(), api.listProducts()])
      .then(([s, p]) => {
        setSuppliers(s);
        setProducts(p);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load suppliers and products."));
  }, []);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!products || !term) return [];
    const inCart = new Set(lines.map((l) => l.productId));
    return products.filter((p) => p.trackStock && !inCart.has(p.id) && `${p.name} ${p.sku}`.toLowerCase().includes(term)).slice(0, 6);
  }, [products, search, lines]);

  const totalCents = lines.reduce((sum, l) => sum + (priceTextToCents(l.unitCost) ?? 0) * (Number.parseInt(l.quantity, 10) || 0), 0);

  function addLine(product: ProductListItem): void {
    setLines((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        taxType: product.taxType,
        quantity: "1",
        unitCost: "",
        sellingPrice: "",
      },
    ]);
    setSearch("");
  }

  function updateLine(productId: string, patch: Partial<Line>): void {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  }

  async function submit(intent: "draft" | "ordered"): Promise<void> {
    if (!supplierId) return setError("Choose a supplier.");
    if (!locationId) return setError("Choose where the goods will be received.");
    if (lines.length === 0) return setError("Add at least one product.");
    const items = [];
    for (const line of lines) {
      const orderedQuantity = Number.parseInt(line.quantity, 10);
      const unitCostCents = priceTextToCents(line.unitCost);
      if (!orderedQuantity || orderedQuantity <= 0) return setError(`Enter a quantity for ${line.name}.`);
      if (unitCostCents === null) return setError(`Enter the unit cost for ${line.name}.`);
      items.push({
        productId: line.productId,
        orderedQuantity,
        unitCostCents,
        sellingPriceCents: line.sellingPrice.trim() ? priceTextToCents(line.sellingPrice) : null,
        taxType: line.taxType,
      });
    }

    setSaving(intent);
    setError(null);
    try {
      const result = await api.createPurchase({
        id: purchaseId.current,
        supplierId,
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || null,
        locationId,
        shippingCostCents: priceTextToCents(shippingFee) ?? 0,
        shippingExpenseCents: priceTextToCents(shippingCost) ?? 0,
        notes: notes.trim() || null,
        items,
        intent,
      });
      onCreated(result.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save purchase.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <BottomSheet title="New Purchase" subtitle="Stock is added when you receive the goods." onClose={onClose}>
        {!suppliers || !products ? (
          error ? (
            <SheetError message={error} />
          ) : (
            <p className="py-10 text-center text-sm text-navy/50">Loading…</p>
          )
        ) : (
          <div className="space-y-3">
            <SheetError message={error} />

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SheetField label="Supplier">
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={sheetInputClass}>
                    <option value="" disabled>
                      Choose a supplier
                    </option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.businessName}
                      </option>
                    ))}
                  </select>
                </SheetField>
              </div>
              <button
                type="button"
                onClick={() => setCreatingSupplier(true)}
                aria-label="New supplier"
                className="grid size-[38px] flex-none place-items-center rounded-lg border border-navy/15 text-navy/60 hover:bg-cream-dark"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>

            <SheetField label="Receive into">
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={locations.length === 1} className={sheetInputClass}>
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

            <div>
              <p className="text-[11px] font-semibold text-navy/50">Products</p>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search to add a product…"
                  className={`${sheetInputClass} mt-0 pl-9`}
                />
              </div>
              {matches.length > 0 && (
                <div className="mt-1 divide-y divide-navy/10 rounded-lg border border-navy/15">
                  {matches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addLine(p)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-cream-dark"
                    >
                      <span className="truncate font-bold text-navy">{p.name}</span>
                      <span className="flex-none text-navy/40">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {lines.map((line) => (
              <div key={line.productId} className="rounded-lg border border-navy/15 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy">{line.name}</p>
                    <p className="text-[11px] text-navy/40">{line.sku}</p>
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
                <div className="grid grid-cols-3 gap-2">
                  <SheetField label="Qty">
                    <input
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.productId, {
                          quantity: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      className={sheetInputClass}
                    />
                  </SheetField>
                  <SheetField label="Unit cost">
                    <input
                      inputMode="decimal"
                      value={line.unitCost}
                      onChange={(e) => updateLine(line.productId, { unitCost: e.target.value })}
                      className={sheetInputClass}
                    />
                  </SheetField>
                  <SheetField label="New sell price">
                    <input
                      inputMode="decimal"
                      value={line.sellingPrice}
                      onChange={(e) =>
                        updateLine(line.productId, {
                          sellingPrice: e.target.value,
                        })
                      }
                      placeholder="Keep"
                      className={sheetInputClass}
                    />
                  </SheetField>
                </div>
              </div>
            ))}

            <button type="button" onClick={() => setShowMore((v) => !v)} className="flex items-center gap-1 text-xs font-bold text-blue">
              <ChevronDown className={`size-3.5 transition ${showMore ? "rotate-180" : ""}`} aria-hidden="true" />
              Invoice number, shipping & notes
            </button>
            {showMore && (
              <div className="space-y-3 rounded-lg bg-cream-dark/50 p-3">
                <SheetField label="Supplier's invoice number">
                  <input value={supplierInvoiceNumber} onChange={(e) => setSupplierInvoiceNumber(e.target.value)} className={sheetInputClass} />
                </SheetField>
                <div className="grid grid-cols-2 gap-3">
                  <SheetField label="Shipping fee (owed to supplier)">
                    <input
                      inputMode="decimal"
                      value={shippingFee}
                      onChange={(e) => setShippingFee(e.target.value)}
                      placeholder="0"
                      className={sheetInputClass}
                    />
                  </SheetField>
                  <SheetField label="Shipping cost (our expense)">
                    <input
                      inputMode="decimal"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      placeholder="0"
                      className={sheetInputClass}
                    />
                  </SheetField>
                </div>
                <SheetField label="Notes">
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={sheetInputClass} />
                </SheetField>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-dashed border-navy/15 pt-3 text-sm">
              <span className="text-navy/60">Items total (before tax)</span>
              <span className="font-display text-navy">{formatCents(totalCents, currency)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => void submit("draft")}
                className="flex items-center justify-center gap-2 rounded-lg border border-navy/20 py-3 text-sm font-bold text-navy disabled:opacity-50"
              >
                {saving === "draft" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Save Draft
              </button>
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => void submit("ordered")}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving === "ordered" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Place Order
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {creatingSupplier && (
        <QuickCreateSupplierModal
          onClose={() => setCreatingSupplier(false)}
          onCreated={(supplier) => {
            setSuppliers((prev) => [...(prev ?? []), supplier]);
            setSupplierId(supplier.id);
            setCreatingSupplier(false);
          }}
        />
      )}
    </>
  );
}
