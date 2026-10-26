"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Phone, Plus, Search, UserRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { MobileCustomerWithBalance } from "@/lib/types";
import { CustomerDebtModal } from "../customers/CustomerDebtModal";
import { FilterChip } from "../FilterChip";
import { QuickCreateCustomerModal } from "../QuickCreateCustomerModal";

/** Customer directory with what each one owes — debtors first. Tapping a customer who owes opens
 * their unpaid invoices and (with sales.edit, the same grant as paying a single invoice) Collect
 * Payment, which SERVER spreads across those invoices oldest first. */
export function CustomersTab({ currency, canCollect }: { currency: string; canCollect: boolean }) {
  const [customers, setCustomers] = useState<MobileCustomerWithBalance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [owingOnly, setOwingOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [debtFor, setDebtFor] = useState<MobileCustomerWithBalance | null>(null);

  const loadCustomers = useCallback(() => {
    api
      .listCustomerBalances()
      .then(setCustomers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load customers."));
  }, []);

  useEffect(loadCustomers, [loadCustomers]);

  const totalOwedCents = useMemo(() => (customers ?? []).reduce((sum, c) => sum + c.balanceDueCents, 0), [customers]);

  const filtered = useMemo(() => {
    if (!customers) return null;
    const term = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (owingOnly && c.balanceDueCents <= 0) return false;
      return !term || `${c.name} ${c.phone} ${c.customerCode}`.toLowerCase().includes(term);
    });
  }, [customers, search, owingOnly]);

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 flex items-center gap-2 border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="w-full rounded-lg border border-navy/15 bg-white py-2 pl-9 pr-3 text-sm text-navy placeholder:text-navy/30 focus:border-blue focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex flex-none items-center gap-1 rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          New
        </button>
      </div>
      {totalOwedCents > 0 && (
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <FilterChip label="Owing" active={owingOnly} onClick={() => setOwingOnly((v) => !v)} />
          <p className="text-xs text-navy/60">
            Customers owe <span className="font-bold text-red">{formatCents(totalOwedCents, currency)}</span>
          </p>
        </div>
      )}

      <div className="px-4 py-4">
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!customers && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {filtered && filtered.length === 0 && <p className="py-10 text-center text-sm text-navy/50">No customers match.</p>}

        {filtered && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((customer) => (
              <button
                key={customer.id}
                type="button"
                disabled={customer.balanceDueCents <= 0}
                onClick={() => setDebtFor(customer)}
                className="flex w-full items-center gap-3 rounded-lg bg-white p-3 text-left shadow-sm disabled:cursor-default"
              >
                <div className="grid size-10 flex-none place-items-center rounded-full bg-navy/10 text-navy">
                  <UserRound className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-navy">{customer.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-navy/50">
                    <Phone className="size-3 flex-none" aria-hidden="true" />
                    {customer.phone}
                  </p>
                </div>
                {customer.balanceDueCents > 0 ? (
                  <span className="flex-none text-right">
                    <span className="block font-display text-sm text-red">{formatCents(customer.balanceDueCents, currency)}</span>
                    <span className="block text-[10px] text-navy/50">
                      {customer.unpaidInvoiceCount} unpaid {customer.unpaidInvoiceCount === 1 ? "invoice" : "invoices"}
                    </span>
                  </span>
                ) : (
                  <span className="flex-none rounded-full border border-dashed border-navy/25 px-2 py-0.5 text-[10px] font-bold text-navy/60">
                    {customer.customerCode}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <QuickCreateCustomerModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            loadCustomers();
          }}
        />
      )}
      {debtFor && (
        <CustomerDebtModal
          customer={debtFor}
          currency={currency}
          canCollect={canCollect}
          onClose={() => setDebtFor(null)}
          onPaid={loadCustomers}
        />
      )}
    </div>
  );
}
