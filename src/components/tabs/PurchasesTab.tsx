"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MobileLocation, PurchaseListItem } from "@/lib/types";
import { FilterChip } from "../FilterChip";
import { PurchaseCard } from "../PurchaseCard";
import { PurchaseDetailModal } from "../PurchaseDetailModal";

const ALL_FILTER = "__all__";

/** Same storefront-filter + dashed-timeline pattern as Sales/Invoices/Quotations. "View more" opens
 * PurchaseDetailModal (a purpose-built, view-only modal — no Download/Share, since neither exists
 * for Purchases anywhere in this app). */
export function PurchasesTab() {
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [purchases, setPurchases] = useState<PurchaseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {
      // Filter chips just fall back to "All only" — not worth failing the whole tab over.
    });
  }, []);

  useEffect(() => {
    setPurchases(null);
    setError(null);
    api
      .listPurchases(locationFilter === ALL_FILTER ? undefined : locationFilter)
      .then(setPurchases)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load purchases."));
  }, [locationFilter]);

  return (
    <div className="pb-10">
      {locations && locations.length > 1 && (
        <div className="sticky top-[60px] z-10 flex gap-1.5 overflow-x-auto border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip label="All" active={locationFilter === ALL_FILTER} onClick={() => setLocationFilter(ALL_FILTER)} />
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

      <div className="px-4 py-4">
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!purchases && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {purchases && purchases.length === 0 && <p className="py-10 text-center text-sm text-navy/50">No purchases yet.</p>}

        {purchases && purchases.length > 0 && (
          <div className="relative">
            <div
              className="pointer-events-none absolute top-2 bottom-2 left-3 border-l-2 border-dashed border-navy/20"
              aria-hidden="true"
            />
            <div className="space-y-3 pl-7">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="relative">
                  <span
                    className="pointer-events-none absolute top-9 -left-[19px] size-2 -translate-y-1/2 rounded-full border-2 border-navy/25 bg-cream-dark"
                    aria-hidden="true"
                  />
                  <PurchaseCard purchase={purchase} onSelect={() => setSelectedPurchaseId(purchase.id)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedPurchaseId && <PurchaseDetailModal purchaseId={selectedPurchaseId} onClose={() => setSelectedPurchaseId(null)} />}
    </div>
  );
}
