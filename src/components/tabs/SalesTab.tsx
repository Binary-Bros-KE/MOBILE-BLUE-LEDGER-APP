"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MobileLocation, SaleListItem } from "@/lib/types";
import { DocumentDetailModal } from "../DocumentDetailModal";
import { FilterChip } from "../FilterChip";
import { SaleCard } from "../SaleCard";

const ALL_FILTER = "__all__";

/** "Sales" here is DESKTOP's own Receipts tab — a walk-in transaction, not an invoice. Filtering
 * re-fetches from SERVER per storefront (mobile-sales-service.ts) rather than filtering a
 * client-loaded list, since the list itself is capped to the 200 most recent rows — filtering that
 * client-side after the fact could hide real sales for a storefront that fell outside the global
 * cap despite ranking well inside its own storefront's most-recent-200. */
export function SalesTab({ canManageDelivery = false }: { canManageDelivery?: boolean }) {
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [sales, setSales] = useState<SaleListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const filteredSales = useMemo(() => {
    if (!sales) return null;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sales;
    return sales.filter((sale) =>
      [sale.receiptNumber, sale.customerName, sale.employeeName].filter(Boolean).join(" ").toLowerCase().includes(term),
    );
  }, [sales, searchTerm]);

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {
      // Filter chips just fall back to "All only" — not worth failing the whole tab over.
    });
  }, []);

  useEffect(() => {
    setSales(null);
    setError(null);
    api
      .listSales(locationFilter === ALL_FILTER ? undefined : locationFilter)
      .then(setSales)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load sales."));
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

      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search receipt #, customer, or cashier..."
            className="h-10 w-full rounded-lg border border-navy/15 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue"
          />
        </div>
      </div>

      <div className="px-4 py-4">
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!sales && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {sales && filteredSales?.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/50">{searchTerm ? "No sales match your search." : "No sales yet."}</p>
        )}

        {filteredSales && filteredSales.length > 0 && (
          <div className="relative">
            <div
              className="pointer-events-none absolute top-2 bottom-2 left-3 border-l-2 border-dashed border-navy/20"
              aria-hidden="true"
            />
            <div className="space-y-3 pl-7">
              {filteredSales.map((sale) => (
                <div key={sale.id} className="relative">
                  <span
                    className="pointer-events-none absolute top-9 -left-[19px] size-2 -translate-y-1/2 rounded-full border-2 border-navy/25 bg-cream-dark"
                    aria-hidden="true"
                  />
                  <SaleCard sale={sale} onSelect={() => setSelectedSaleId(sale.id)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedSaleId && (
        <DocumentDetailModal saleId={selectedSaleId} canManageDelivery={canManageDelivery} onClose={() => setSelectedSaleId(null)} />
      )}
    </div>
  );
}
