"use client";

import { useEffect, useMemo, useState } from "react";
import { FileBarChart, Plus, Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { TenantTaxConfig } from "@/lib/tax";
import type { InvoiceListItem, MobileCustomer, MobileLocation } from "@/lib/types";
import { DocumentDetailModal } from "../DocumentDetailModal";
import { InvoiceFormModal } from "../documents/InvoiceFormModal";
import { FilterChip } from "../FilterChip";
import { InvoiceCard } from "../InvoiceCard";
import { StatementDetailModal } from "../StatementDetailModal";

const ALL_FILTER = "__all__";

/** Same storefront-filter + dashed-timeline pattern as SalesTab, plus a "Statement" action and a
 * "New Invoice" action in its own small header — matching DESKTOP's own InvoicesRoute.tsx, where
 * Statement lives as a toolbar button on the Invoices tab rather than a nav entry of its own (see
 * [[project_customer_statement_feature]] for why). */
export function InvoicesTab({
  branchId,
  branchName,
  currency,
  tenantTaxConfig,
  canApprove,
  canManageDelivery = false,
  defaultIncludeBusinessInfo,
}: {
  branchId: string | null;
  branchName: string | null;
  currency: string;
  tenantTaxConfig: TenantTaxConfig;
  /** Whether the signed-in employee has approvals.approve — passed straight through to
   * DocumentDetailModal, which decides "Cancel Invoice" vs. "Request Cancellation" from it. */
  canApprove: boolean;
  /** sales:edit — gates the "Mark as Delivered" button, passed straight through. */
  canManageDelivery?: boolean;
  /** See InvoiceFormModal's identical prop for the same reasoning. */
  defaultIncludeBusinessInfo?: boolean | null;
}) {
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const [statementPickerOpen, setStatementPickerOpen] = useState(false);
  const [customers, setCustomers] = useState<MobileCustomer[] | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [statementCustomerId, setStatementCustomerId] = useState<string | null>(null);
  // null = closed, "new" = create form, any other string = edit form for that invoice id.
  const [formTarget, setFormTarget] = useState<string | null>(null);

  function refreshInvoices(): void {
    api
      .listInvoices(locationFilter === ALL_FILTER ? undefined : locationFilter)
      .then(setInvoices)
      .catch(() => undefined);
  }

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {
      // Filter chips just fall back to "All only" — not worth failing the whole tab over.
    });
  }, []);

  useEffect(() => {
    setInvoices(null);
    setError(null);
    api
      .listInvoices(locationFilter === ALL_FILTER ? undefined : locationFilter)
      .then(setInvoices)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load invoices."));
  }, [locationFilter]);

  function openStatementPicker(): void {
    setCustomerSearch("");
    setStatementPickerOpen(true);
    if (!customers) {
      api.listCustomers().then(setCustomers).catch(() => {
        // The picker just shows "no customers found" either way — not worth a dedicated error state.
      });
    }
  }

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers.slice(0, 30);
    return customers.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(term)).slice(0, 30);
  }, [customers, customerSearch]);

  const filteredInvoices = useMemo(() => {
    if (!invoices) return null;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter((invoice) =>
      [invoice.invoiceNumber, invoice.customerName, invoice.employeeName].filter(Boolean).join(" ").toLowerCase().includes(term),
    );
  }, [invoices, searchTerm]);

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 border-b border-navy/10 bg-cream-dark/95 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <p className="text-xs font-bold text-navy/50">Billing &amp; Receivables</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={openStatementPicker}
              className="flex items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-xs font-bold text-navy"
            >
              <FileBarChart className="size-3.5" aria-hidden="true" />
              Statement
            </button>
            <button
              type="button"
              onClick={() => setFormTarget("new")}
              className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              New
            </button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search invoice #, customer, or cashier..."
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
        {!invoices && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {invoices && filteredInvoices?.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/50">{searchTerm ? "No invoices match your search." : "No invoices yet."}</p>
        )}

        {filteredInvoices && filteredInvoices.length > 0 && (
          <div className="relative">
            <div
              className="pointer-events-none absolute top-2 bottom-2 left-3 border-l-2 border-dashed border-navy/20"
              aria-hidden="true"
            />
            <div className="space-y-3 pl-7">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="relative">
                  <span
                    className="pointer-events-none absolute top-9 -left-[19px] size-2 -translate-y-1/2 rounded-full border-2 border-navy/25 bg-cream-dark"
                    aria-hidden="true"
                  />
                  <InvoiceCard invoice={invoice} onSelect={() => setSelectedInvoiceId(invoice.id)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedInvoiceId && (
        <DocumentDetailModal
          saleId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onChanged={refreshInvoices}
          canApprove={canApprove}
          canManageDelivery={canManageDelivery}
          onEdit={() => {
            const id = selectedInvoiceId;
            setSelectedInvoiceId(null);
            setFormTarget(id);
          }}
        />
      )}

      {formTarget && (
        <InvoiceFormModal
          branchId={branchId}
          branchName={branchName}
          currency={currency}
          tenantTaxConfig={tenantTaxConfig}
          editId={formTarget === "new" ? undefined : formTarget}
          defaultIncludeBusinessInfo={defaultIncludeBusinessInfo}
          onClose={() => setFormTarget(null)}
          onCreated={(id) => {
            setFormTarget(null);
            refreshInvoices();
            setSelectedInvoiceId(id);
          }}
        />
      )}

      {statementPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center"
          onClick={() => setStatementPickerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full max-w-sm overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
          >
            <div className="border-b border-navy/10 p-4">
              <p className="font-display text-base text-navy">Generate Statement</p>
              <p className="text-xs text-navy/50">Search for a customer to see every invoice they haven&apos;t fully paid off yet.</p>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
                <input
                  autoFocus
                  type="text"
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Search customers..."
                  className="h-10 w-full rounded-lg border border-navy/15 bg-cream-dark/40 pr-3 pl-9 text-sm outline-none focus:border-blue"
                />
              </div>
            </div>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto p-3">
              {!customers && <p className="py-8 text-center text-xs text-navy/50">Loading…</p>}
              {customers && filteredCustomers.length === 0 && <p className="py-8 text-center text-xs text-navy/50">No customers found</p>}
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    setStatementPickerOpen(false);
                    setStatementCustomerId(customer.id);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-cream-dark"
                >
                  <span className="text-sm font-bold text-navy">{customer.name}</span>
                  <span className="text-xs text-navy/50">{customer.phone}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {statementCustomerId && <StatementDetailModal customerId={statementCustomerId} onClose={() => setStatementCustomerId(null)} />}
    </div>
  );
}
