"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { TenantTaxConfig } from "@/lib/tax";
import type { MobileLocation, QuotationListItem } from "@/lib/types";
import { DocumentDetailModal } from "../DocumentDetailModal";
import { QuotationFormModal } from "../documents/QuotationFormModal";
import { FilterChip } from "../FilterChip";
import { QuotationCard } from "../QuotationCard";

const ALL_FILTER = "__all__";

/** Same storefront-filter + dashed-timeline pattern as SalesTab/InvoicesTab. Unlike Invoices, a
 * Quotation is its own table (not a Sale row with invoiceNumber set) — see mobile-quotations-
 * service.ts — so DocumentDetailModal is told kind="quotation" to fetch/share through the right
 * endpoints; the rendered document template itself needs no changes. */
export function QuotationsTab({
  branchId,
  branchName,
  currency,
  tenantTaxConfig,
  canManageDelivery = false,
  defaultIncludeBusinessInfo,
}: {
  branchId: string | null;
  branchName: string | null;
  currency: string;
  tenantTaxConfig: TenantTaxConfig;
  /** sales:edit — gates the "Mark as Delivered" button, passed straight through. */
  canManageDelivery?: boolean;
  /** See InvoiceFormModal's identical prop for the same reasoning. */
  defaultIncludeBusinessInfo?: boolean | null;
}) {
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [quotations, setQuotations] = useState<QuotationListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  // null = closed, "new" = create form, any other string = edit form for that quotation id.
  const [formTarget, setFormTarget] = useState<string | null>(null);

  const filteredQuotations = useMemo(() => {
    if (!quotations) return null;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return quotations;
    return quotations.filter((quotation) =>
      [quotation.quotationNumber, quotation.customerName, quotation.employeeName].filter(Boolean).join(" ").toLowerCase().includes(term),
    );
  }, [quotations, searchTerm]);

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {
      // Filter chips just fall back to "All only" — not worth failing the whole tab over.
    });
  }, []);

  function refreshQuotations(): void {
    api
      .listQuotations(locationFilter === ALL_FILTER ? undefined : locationFilter)
      .then(setQuotations)
      .catch(() => undefined);
  }

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
      <div className="sticky top-[60px] z-10 border-b border-navy/10 bg-cream-dark/95 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <p className="text-xs font-bold text-navy/50">Quotations</p>
          <button
            type="button"
            onClick={() => setFormTarget("new")}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search quotation #, customer, or cashier..."
              className="h-10 w-full rounded-lg border border-navy/15 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue"
            />
          </div>
        </div>
        {locations && locations.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      </div>

      <div className="px-4 py-4">
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!quotations && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {quotations && filteredQuotations?.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/50">{searchTerm ? "No quotations match your search." : "No quotations yet."}</p>
        )}

        {filteredQuotations && filteredQuotations.length > 0 && (
          <div className="relative">
            <div
              className="pointer-events-none absolute top-2 bottom-2 left-3 border-l-2 border-dashed border-navy/20"
              aria-hidden="true"
            />
            <div className="space-y-3 pl-7">
              {filteredQuotations.map((quotation) => (
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
        <DocumentDetailModal
          saleId={selectedQuotationId}
          kind="quotation"
          onClose={() => setSelectedQuotationId(null)}
          onChanged={refreshQuotations}
          canManageDelivery={canManageDelivery}
          onEdit={() => {
            const id = selectedQuotationId;
            setSelectedQuotationId(null);
            setFormTarget(id);
          }}
        />
      )}

      {formTarget && (
        <QuotationFormModal
          branchId={branchId}
          branchName={branchName}
          currency={currency}
          tenantTaxConfig={tenantTaxConfig}
          editId={formTarget === "new" ? undefined : formTarget}
          defaultIncludeBusinessInfo={defaultIncludeBusinessInfo}
          onClose={() => setFormTarget(null)}
          onCreated={(id) => {
            setFormTarget(null);
            refreshQuotations();
            setSelectedQuotationId(id);
          }}
        />
      )}
    </div>
  );
}
