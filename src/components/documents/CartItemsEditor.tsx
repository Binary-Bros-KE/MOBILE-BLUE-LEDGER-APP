"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Search, Store, Trash2 } from "lucide-react";
import { formatCents, unitCostToTotalCents } from "@/lib/money";
import { computeCartLineTaxResults, naturalUnitPriceCents } from "@/lib/cart-totals";
import type { TenantTaxConfig } from "@/lib/tax";
import type { CheckoutCartLine, MobileSupplier, ProductListItem } from "@/lib/types";
import { QuickCreateSupplierModal } from "../QuickCreateSupplierModal";

/** The product-search-and-add + cart-line-list UI shared by the Invoice and Quotation create/edit
 * forms — price override (mark-up, floored at the product's own minimumPriceCents), discount, and
 * "sourced from another shop" (cost + supplier). CheckoutTab.tsx has its own separate, independently
 * maintained inline copy of this same UI rather than actually rendering this component (despite an
 * earlier version of this comment claiming otherwise) — keep both in sync by hand if either changes,
 * e.g. money.ts's unitCostToTotalCents/totalCentsToUnitCostText pair. Fully controlled — the parent
 * owns `cart` and gets a new array back via `onCartChange`. */
export function CartItemsEditor({
  products,
  cart,
  onCartChange,
  suppliers,
  onSuppliersChange,
  currency,
  tenantTaxConfig,
}: {
  products: ProductListItem[] | null;
  cart: CheckoutCartLine[];
  onCartChange: (cart: CheckoutCartLine[]) => void;
  suppliers: MobileSupplier[];
  onSuppliersChange: (suppliers: MobileSupplier[]) => void;
  currency: string;
  tenantTaxConfig: TenantTaxConfig;
}) {
  const [search, setSearch] = useState("");
  const [quickCreateSupplierFor, setQuickCreateSupplierFor] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return products.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)).slice(0, 12);
  }, [products, search]);

  const lineTaxResults = computeCartLineTaxResults(cart, tenantTaxConfig);

  function addToCart(product: ProductListItem): void {
    const existing = cart.find((line) => line.productId === product.id);
    if (existing) {
      onCartChange(cart.map((line) => (line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line)));
    } else {
      onCartChange([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPriceCents: product.sellingPriceCents,
          quantity: 1,
          discountAmountCents: 0,
          taxType: product.taxType,
          pricesTaxInclusive: product.pricesTaxInclusive,
          minimumPriceCents: product.minimumPriceCents,
          wholesalePriceCents: product.wholesalePriceCents,
          wholesaleMinQuantity: product.wholesaleMinQuantity,
          priceOverride: "",
          isLocallySourced: false,
          localCost: "",
          localSupplierId: null,
        },
      ]);
    }
    setSearch("");
  }

  function updateLine(productId: string, patch: Partial<CheckoutCartLine>): void {
    onCartChange(cart.map((line) => (line.productId === productId ? { ...line, ...patch } : line)));
  }

  function updateQuantity(productId: string, quantity: number): void {
    if (quantity < 1) return;
    updateLine(productId, { quantity });
  }

  function toggleLocallySourced(line: CheckoutCartLine): void {
    updateLine(line.productId, {
      isLocallySourced: !line.isLocallySourced,
      ...(line.isLocallySourced ? { localCost: "", localSupplierId: null } : {}),
    });
  }

  function removeLine(productId: string): void {
    onCartChange(cart.filter((line) => line.productId !== productId));
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products to add…"
          className="w-full rounded-lg border border-navy/15 bg-white py-2.5 pl-9 pr-3 text-sm text-navy placeholder:text-navy/30 focus:border-blue focus:outline-none"
        />
      </div>
      {filteredProducts.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg border border-navy/10 bg-white p-1.5 shadow-sm">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addToCart(product)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left hover:bg-cream-dark"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy">{product.name}</p>
                <p className="text-[11px] text-navy/50">
                  {product.sku} · {product.totalQuantity} in stock
                </p>
              </div>
              <p className="flex-none text-sm font-bold text-navy">{formatCents(product.sellingPriceCents, currency)}</p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-2">
        {cart.length === 0 ? (
          <p className="rounded-lg border border-dashed border-navy/15 py-8 text-center text-sm text-navy/50">
            Search above to add products.
          </p>
        ) : (
          <div className="space-y-2">
            {cart.map((line, index) => {
              const priceBelowMinimum =
                line.priceOverride.trim() && line.minimumPriceCents !== null && Math.round(Number(line.priceOverride) * 100) < line.minimumPriceCents;
              const naturalPriceCents = naturalUnitPriceCents(line);
              const wholesaleActive = naturalPriceCents !== line.unitPriceCents;
              return (
                <div key={line.productId} className="rounded-lg border border-navy/10 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-navy">{line.name}</p>
                      <p className="text-[11px] text-navy/50">
                        @ {formatCents(naturalPriceCents, currency)}
                        {wholesaleActive && <span className="ml-1 font-bold text-blue">Wholesale</span>}
                      </p>
                    </div>
                    <button type="button" onClick={() => removeLine(line.productId)} aria-label={`Remove ${line.name}`} className="flex-none text-navy/30 hover:text-red">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.productId, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                        className="grid size-7 place-items-center rounded-md border border-navy/15 text-navy/60 disabled:opacity-30"
                      >
                        <Minus className="size-3" aria-hidden="true" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-navy">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.productId, line.quantity + 1)}
                        className="grid size-7 place-items-center rounded-md border border-navy/15 text-navy/60"
                      >
                        <Plus className="size-3" aria-hidden="true" />
                      </button>
                    </div>
                    <label className="flex flex-1 items-center gap-1.5 text-[11px] font-semibold text-navy/50">
                      Price
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.priceOverride}
                        onChange={(e) => updateLine(line.productId, { priceOverride: e.target.value })}
                        placeholder={(naturalPriceCents / 100).toFixed(2)}
                        className={`w-full min-w-0 rounded-md border px-1.5 py-1 text-right text-xs font-semibold focus:outline-none ${
                          priceBelowMinimum ? "border-red text-red" : "border-navy/15 text-navy focus:border-blue"
                        }`}
                      />
                    </label>
                  </div>
                  {priceBelowMinimum && (
                    <p className="mt-1 text-right text-[10px] font-bold text-red">
                      Below minimum price of {formatCents(line.minimumPriceCents as number, currency)}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-navy/50">
                      Discount
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.discountAmountCents ? (line.discountAmountCents / 100).toString() : ""}
                        onChange={(e) =>
                          updateLine(line.productId, { discountAmountCents: e.target.value.trim() ? Math.round(Number(e.target.value) * 100) : 0 })
                        }
                        placeholder="0.00"
                        className="w-16 rounded-md border border-navy/15 px-1.5 py-1 text-right text-xs font-semibold text-navy focus:border-blue focus:outline-none"
                      />
                    </label>
                    <p className="flex-none text-sm font-bold text-navy">{formatCents(lineTaxResults[index].grossCents, currency)}</p>
                  </div>

                  <label className="mt-2.5 flex cursor-pointer items-center gap-1.5 text-[10px] font-bold text-navy/50">
                    <input type="checkbox" checked={line.isLocallySourced} onChange={() => toggleLocallySourced(line)} className="size-3.5 accent-blue" />
                    <Store className="size-3 flex-none" aria-hidden="true" />
                    Sourced from another shop
                  </label>

                  {line.isLocallySourced && (
                    <div className="mt-2 space-y-2 rounded-md bg-cream-dark/60 p-2.5">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-navy/50">Unit Cost</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.localCost}
                          onChange={(e) => updateLine(line.productId, { localCost: e.target.value })}
                          placeholder="0.00"
                          className="mt-1 w-full rounded-md border border-navy/15 px-2.5 py-1.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
                        />
                      </label>
                      {line.localCost.trim() && (
                        <p className="text-[10px] font-semibold text-navy/40">
                          Total for {line.quantity}: {formatCents(unitCostToTotalCents(line.localCost, line.quantity), currency)}
                        </p>
                      )}
                      <div>
                        <span className="text-[11px] font-semibold text-navy/50">Local Supplier</span>
                        <div className="mt-1 flex gap-1.5">
                          <select
                            value={line.localSupplierId ?? ""}
                            onChange={(e) => updateLine(line.productId, { localSupplierId: e.target.value || null })}
                            className="h-9 w-full rounded-md border border-navy/15 bg-white px-2.5 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
                          >
                            <option value="">Select a supplier…</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.businessName}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setQuickCreateSupplierFor(line.productId)}
                            className="grid h-9 w-9 flex-none place-items-center rounded-md border border-navy/15 text-navy/60"
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {quickCreateSupplierFor && (
        <QuickCreateSupplierModal
          onClose={() => setQuickCreateSupplierFor(null)}
          onCreated={(supplier) => {
            onSuppliersChange([...suppliers, supplier]);
            updateLine(quickCreateSupplierFor, { localSupplierId: supplier.id });
            setQuickCreateSupplierFor(null);
          }}
        />
      )}
    </div>
  );
}
