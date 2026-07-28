"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MobileLocation, StockMovementRow as StockMovementRowType, StockMovementType } from "@/lib/types";
import { FilterChip } from "../FilterChip";
import { STOCK_MOVEMENT_TYPE_LABELS, StockMovementRow } from "../StockMovementRow";

const ALL_FILTER = "__all__";

const TYPE_OPTIONS: StockMovementType[] = ["purchase", "sale", "transfer_in", "transfer_out", "return", "damage", "adjustment", "opening_stock"];

/** Ported from DESKTOP's StockLedgerRoute.tsx — every stock movement across every product, in one
 * flat feed. Same storefront-filter-chips pattern as the other list tabs, plus a second row of
 * movement-type chips (also single-select, matching DESKTOP's own type filter). Type filtering is
 * done client-side against the already-fetched (storefront-filtered, 200-row-capped) list — no need
 * for a second round trip for a simple category narrow. No per-row detail view, matching DESKTOP's
 * own flat-table precedent (see StockMovementRow.tsx). */
export function StockLedgerTab() {
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [movements, setMovements] = useState<StockMovementRowType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);
  const [typeFilter, setTypeFilter] = useState<StockMovementType | typeof ALL_FILTER>(ALL_FILTER);

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {
      // Filter chips just fall back to "All only" — not worth failing the whole tab over.
    });
  }, []);

  useEffect(() => {
    setMovements(null);
    setError(null);
    api
      .listStockMovements(locationFilter === ALL_FILTER ? undefined : locationFilter)
      .then(setMovements)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the stock ledger."));
  }, [locationFilter]);

  const filtered = movements?.filter((movement) => typeFilter === ALL_FILTER || movement.movementType === typeFilter) ?? null;

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 space-y-2 border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur">
        {locations && locations.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip label="All Storefronts" active={locationFilter === ALL_FILTER} onClick={() => setLocationFilter(ALL_FILTER)} />
            {locations.map((location) => (
              <FilterChip
                key={location.id}
                label={location.locationName}
                active={locationFilter === location.id}
                onClick={() => setLocationFilter(location.id)}
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
