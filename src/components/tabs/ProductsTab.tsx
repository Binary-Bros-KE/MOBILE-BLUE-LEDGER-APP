"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ProductListItem } from "@/lib/types";
import { FilterChip } from "../FilterChip";
import { ProductCard } from "../ProductCard";

const ALL_CATEGORY = "__all__";

/** No storefront filter here (unlike every other tab) — per explicit user ask, just two independent
 * toggle chips, Low Stock and Out of Stock, either or both active at once (not the "All + one per
 * location" radio-group pattern the other tabs use). The full catalog is fetched once; toggling
 * filters client-side is fine here since this is a bounded product list, not a recency-capped feed
 * like Sales/Transactions where client-side filtering after a cap could hide real rows.
 *
 * Category chips are built from whatever distinct categoryName values are actually present in the
 * fetched catalog (mirrors DESKTOP's own buildCategoryOptions, minus the parent-path nesting since
 * mobile's categoryName is already flattened server-side) — selecting one narrows the pool, then
 * search further filters within it, same combined useMemo DESKTOP's ProductsRoute.tsx uses. */
export function ProductsTab({ currency }: { currency: string }) {
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORY);

  useEffect(() => {
    api
      .listProducts()
      .then(setProducts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load products."));
  }, []);

  const categories = useMemo(() => {
    if (!products) return [];
    return Array.from(new Set(products.map((p) => p.categoryName).filter((name): name is string => !!name))).sort();
  }, [products]);

  const filtered = useMemo(() => {
    if (!products) return null;
    const term = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      if (lowStockOnly && !p.lowStock) return false;
      if (outOfStockOnly && !p.outOfStock) return false;
      if (categoryFilter !== ALL_CATEGORY && p.categoryName !== categoryFilter) return false;
      if (term && !`${p.name} ${p.sku}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, lowStockOnly, outOfStockOnly, categoryFilter, searchTerm]);

  const hasActiveFilter = lowStockOnly || outOfStockOnly || categoryFilter !== ALL_CATEGORY || searchTerm.trim().length > 0;

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 border-b border-navy/10 bg-cream-dark/95 backdrop-blur">
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search products by name or SKU..."
              className="h-10 w-full rounded-lg border border-navy/15 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue"
            />
          </div>
        </div>
        <div className="flex gap-1.5 px-4 py-3">
          <FilterChip label="Low Stock" active={lowStockOnly} onClick={() => setLowStockOnly((v) => !v)} />
          <FilterChip label="Out of Stock" active={outOfStockOnly} onClick={() => setOutOfStockOnly((v) => !v)} />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip label="All" active={categoryFilter === ALL_CATEGORY} onClick={() => setCategoryFilter(ALL_CATEGORY)} />
            {categories.map((category) => (
              <FilterChip key={category} label={category} active={categoryFilter === category} onClick={() => setCategoryFilter(category)} />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!products && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {filtered && filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/50">
            {hasActiveFilter ? "No products match this filter." : "No products yet."}
          </p>
        )}

        {filtered && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} currency={currency} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
