"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone, Plus, Search, UserRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MobileCustomer } from "@/lib/types";
import { QuickCreateCustomerModal } from "../QuickCreateCustomerModal";

export function CustomersTab() {
  const [customers, setCustomers] = useState<MobileCustomer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    api
      .listCustomers()
      .then(setCustomers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load customers."));
  }, []);

  const filtered = useMemo(() => {
    if (!customers) return null;
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => `${c.name} ${c.phone} ${c.customerCode}`.toLowerCase().includes(term));
  }, [customers, search]);

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

      <div className="px-4 py-4">
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!customers && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {filtered && filtered.length === 0 && <p className="py-10 text-center text-sm text-navy/50">No customers match.</p>}

        {filtered && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((customer) => (
              <div key={customer.id} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
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
                <span className="flex-none rounded-full border border-dashed border-navy/25 px-2 py-0.5 text-[10px] font-bold text-navy/60">
                  {customer.customerCode}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <QuickCreateCustomerModal
          onClose={() => setCreateOpen(false)}
          onCreated={(customer) => {
            setCustomers((prev) => [...(prev ?? []), customer].sort((a, b) => a.name.localeCompare(b.name)));
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}
