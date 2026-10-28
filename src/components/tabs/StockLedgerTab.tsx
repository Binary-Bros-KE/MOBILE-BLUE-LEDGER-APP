"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MobileLocation, ProductListItem, StockMovementRow as StockMovementRowType, StockMovementType } from "@/lib/types";
import { FilterChip } from "../FilterChip";
import { STOCK_MOVEMENT_TYPE_LABELS, StockMovementRow } from "../StockMovementRow";

const ALL_FILTER = "__all__";

const TYPE_OPTIONS: StockMovementType[] = ["purchase", "sale", "transfer_in", "transfer_out", "return", "damage", "adjustment", "opening_stock"];

const PRODUCT_MATCH_LIMIT = 8;

/** Ported from DESKTOP's StockLedgerRoute.tsx — every stock movement across every product, in one
 * flat feed. Same storefront-filter-chips pattern as the other list tabs, plus a second row of
 * movement-type chips (also single-select, matching DESKTOP's own type filter). Type filtering is
 * done client-side against the already-fetched (storefront-filtered, 200-row-capped) list — no need
 * for a second round trip for a simple category narrow. No per-row detail view, matching DESKTOP's
 * own flat-table precedent (see StockMovementRow.tsx).
 *
 * "Track a product" narrows the feed to one product's own history (fetched server-side, so it isn't
 * limited to whatever made the latest 200) with its units in / out / net for the selection. */
export function StockLedgerTab() {
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [movements, setMovements] = useState<StockMovementRowType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);
  const [typeFilter, setTypeFilter] = useState<StockMovementType | typeof ALL_FILTER>(ALL_FILTER);
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [trackedProduct, setTrackedProduct] = useState<ProductListItem | null>(null);

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {
      // Filter chips just fall back to "All only" — not worth failing the whole tab over.
    });
  }, []);

  const trackedProductId = trackedProduct?.id;
  useEffect(() => {
    api
      .listStockMovements(locationFilter === ALL_FILTER ? undefined : locationFilter, trackedProductId)
      .then(setMovements)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the stock ledger."));
  }, [locationFilter, trackedProductId]);

  /** Clears the old storefront's results on a chip tap so they never flash under the new one. */
  function selectLocation(next: string): void {
    setMovements(null);
    setError(null);
    setLocationFilter(next);
  }

  /** Products load the first time the search box is used — archived ones included, their history
   * is still worth looking up. */
  function loadProducts(): void {
    if (products) return;
    api
      .listProducts({ includeAll: true })
      .then(setProducts)
      .catch(() => setProducts([]));
  }

  function trackProduct(product: ProductListItem | null): void {
    setMovements(null);
    setError(null);
    setProductSearch("");
    setTrackedProduct(product);
  }

  const productMatches = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term || !products) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || (p.barcode ?? "").toLowerCase().includes(term))
      .slice(0, PRODUCT_MATCH_LIMIT);
  }, [productSearch, products]);

  const filtered = movements?.filter((movement) => typeFilter === ALL_FILTER || movement.movementType === typeFilter) ?? null;

  const totals = useMemo(() => {
    if (!trackedProduct || !filtered) return null;
    let unitsIn = 0;
    let unitsOut = 0;
    for (const movement of filtered) {
      if (movement.quantityChange > 0) unitsIn += movement.quantityChange;
      else unitsOut += -movement.quantityChange;
    }
    return { unitsIn, unitsOut, net: unitsIn - unitsOut };
  }, [trackedProduct, filtered]);

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 space-y-2 border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur">
        {trackedProduct ? (
          <div className="flex items-center gap-2 rounded-lg bg-navy px-3 py-2 text-white">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-wide text-white/60 uppercase">Tracking product</p>
              <p className="truncate text-sm font-bold">{trackedProduct.name}</p>
            </div>
            <button
              type="button"
              onClick={() => trackProduct(null)}
              aria-label="Stop tracking this product"
              className="grid size-8 flex-none place-items-center rounded-md bg-white/15"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
            <input
              type="text"
              value={productSearch}
              onFocus={loadProducts}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Track a product…"
              className="h-10 w-full rounded-lg border border-navy/15 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue"
            />
            {productSearch.trim() && (
              <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-navy/10 bg-white shadow-lg">
                {!products && <p className="px-3 py-3 text-xs text-navy/50">Loading products…</p>}
                {products && productMatches.length === 0 && <p className="px-3 py-3 text-xs text-navy/50">No products match.</p>}
                {productMatches.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => trackProduct(product)}
                    className="block w-full border-t border-navy/5 px-3 py-2.5 text-left first:border-t-0 active:bg-cream-dark"
                  >
                    <p className="truncate text-sm font-bold text-navy">{product.name}</p>
                    <p className="truncate text-[11px] text-navy/50">{product.sku}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {locations && locations.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip label="All Storefronts" active={locationFilter === ALL_FILTER} onClick={() => selectLocation(ALL_FILTER)} />
            {locations.map((location) => (
              <FilterChip
                key={location.id}
                label={location.locationName}
                active={locationFilter === location.id}
                onClick={() => selectLocation(location.id)}
              />
            ))}
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip label="All Types" active={typeFilter === ALL_FILTER} onClick={() => setTypeFilter(ALL_FILTER)} />
          {TYPE_OPTIONS.map((type) => (
            <FilterChip key={type} label={STOCK_MOVEMENT_TYPE_LABELS[type]} active={typeFilter === type} onClick={() => setTypeFilter(type)} />
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!movements && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}

        {totals && (
          <div className="mb-4 grid grid-cols-3 gap-2">
            <TotalTile label="Units In" value={`+${totals.unitsIn}`} tone="text-green" />
            <TotalTile label="Units Out" value={`-${totals.unitsOut}`} tone="text-red" />
            <TotalTile label="Net" value={`${totals.net > 0 ? "+" : ""}${totals.net}`} tone="text-navy" />
          </div>
        )}

        {filtered && filtered.length === 0 && <p className="py-10 text-center text-sm text-navy/50">No stock movements found.</p>}

        {filtered && filtered.length > 0 && (
          <div className="relative">
            <div
              className="pointer-events-none absolute top-2 bottom-2 left-3 border-l-2 border-dashed border-navy/20"
              aria-hidden="true"
            />
            <div className="space-y-3 pl-7">
              {filtered.map((movement) => (
                <div key={movement.id} className="relative">
                  <span
                    className="pointer-events-none absolute top-9 -left-[19px] size-2 -translate-y-1/2 rounded-full border-2 border-navy/25 bg-cream-dark"
                    aria-hidden="true"
                  />
                  <StockMovementRow movement={movement} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TotalTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white p-3 shadow-sm">
      <p className="truncate text-[10px] font-bold tracking-wide text-navy/50 uppercase">{label}</p>
      <p className={`mt-0.5 truncate font-display text-lg ${tone}`}>{value}</p>
    </div>
  );
}
