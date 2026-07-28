"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MobileLocation, QuotationListItem } from "@/lib/types";
import { DocumentDetailModal } from "../DocumentDetailModal";
import { FilterChip } from "../FilterChip";
import { QuotationCard } from "../QuotationCard";

const ALL_FILTER = "__all__";

/** Same storefront-filter + dashed-timeline pattern as SalesTab/InvoicesTab. Unlike Invoices, a
 * Quotation is its own table (not a Sale row with invoiceNumber set) — see mobile-quotations-
 * service.ts — so DocumentDetailModal is told kind="quotation" to fetch/share through the right
 * endpoints; the rendered document template itself needs no changes. */
export function QuotationsTab() {
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [quotations, setQuotations] = useState<QuotationListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {
      // Filter chips just fall back to "All only" — not worth failing the whole tab over.
    });
  }, []);

  useEffect(() => {
    setQuotations(null);
    setError(null);
    api
      .listQuotations(locationFilter === ALL_FILTER ? undefined : locationFilter)
      .then(setQuotations)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load quotations."));
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
        {!quotations && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {quotations && quotations.length === 0 && <p className="py-10 text-center text-sm text-navy/50">No quotations yet.</p>}

        {quotations && quotations.length > 0 && (
          <div className="relative">
            <div
              className="pointer-events-none absolute top-2 bottom-2 left-3 border-l-2 border-dashed border-navy/20"
              aria-hidden="true"
            />
            <div className="space-y-3 pl-7">
              {quotations.map((quotation) => (
                <div key={quotation.id} className="relative">
                  <span
                    className="pointer-events-none absolute top-9 -left-[19px] size-2 -translate-y-1/2 rounded-full border-2 border-navy/25 bg-cream-dark"
                    aria-hidden="true"
                  />
                  <QuotationCard quotation={quotation} onSelect={() => setSelectedQuotationId(quotation.id)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedQuotationId && (
        <DocumentDetailModal saleId={selectedQuotationId} kind="quotation" onClose={() => setSelectedQuotationId(null)} />
      )}
    </div>
  );
}
