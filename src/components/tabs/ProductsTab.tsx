"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ProductListItem } from "@/lib/types";
import { FilterChip } from "../FilterChip";
import { ProductCard } from "../ProductCard";

/** No storefront filter here (unlike every other tab) — per explicit user ask, just two independent
 * toggle chips, Low Stock and Out of Stock, either or both active at once (not the "All + one per
 * location" radio-group pattern the other tabs use). The full catalog is fetched once; toggling
 * filters client-side is fine here since this is a bounded product list, not a recency-capped feed
 * like Sales/Transactions where client-side filtering after a cap could hide real rows. */
export function ProductsTab() {
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);

  useEffect(() => {
    api
      .listProducts()
      .then(setProducts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load products."));
  }, []);

  const filtered = useMemo(() => {
    if (!products) return null;
    if (!lowStockOnly && !outOfStockOnly) return products;
    return products.filter((p) => (lowStockOnly && p.lowStock) || (outOfStockOnly && p.outOfStock));
  }, [products, lowStockOnly, outOfStockOnly]);

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 flex gap-1.5 border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur">
        <FilterChip label="Low Stock" active={lowStockOnly} onClick={() => setLowStockOnly((v) => !v)} />
        <FilterChip label="Out of Stock" active={outOfStockOnly} onClick={() => setOutOfStockOnly((v) => !v)} />
      </div>

      <div className="px-4 py-4">
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!products && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {filtered && filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/50">
            {lowStockOnly || outOfStockOnly ? "No products match this filter." : "No products yet."}
          </p>
        )}

        {filtered && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
