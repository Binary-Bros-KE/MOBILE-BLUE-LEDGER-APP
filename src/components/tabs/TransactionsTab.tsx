"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MobileLocation, TransactionRow as TransactionRowType } from "@/lib/types";
import { FilterChip } from "../FilterChip";
import { TransactionRow } from "../TransactionRow";

const ALL_FILTER = "__all__";

/** A flat payment ledger — every actual money-movement event (an invoice's individual payments each
 * get their own row), not a "documents" list, so there's no drill-down modal here, just the same
 * storefront-filter + dashed-timeline shell as every other tab. See mobile-transactions-service.ts
 * for what counts as a transaction and why voided/cancelled sales are shown (flagged failed) rather
 * than hidden. */
export function TransactionsTab() {
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [transactions, setTransactions] = useState<TransactionRowType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {
      // Filter chips just fall back to "All only" — not worth failing the whole tab over.
    });
  }, []);

  useEffect(() => {
    setTransactions(null);
    setError(null);
    api
      .listTransactions(locationFilter === ALL_FILTER ? undefined : locationFilter)
      .then(setTransactions)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load transactions."));
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
        {!transactions && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {transactions && transactions.length === 0 && <p className="py-10 text-center text-sm text-navy/50">No transactions yet.</p>}

        {transactions && transactions.length > 0 && (
          <div className="relative">
            <div
              className="pointer-events-none absolute top-2 bottom-2 left-3 border-l-2 border-dashed border-navy/20"
              aria-hidden="true"
            />
            <div className="space-y-3 pl-7">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="relative">
                  <span
                    className="pointer-events-none absolute top-9 -left-[19px] size-2 -translate-y-1/2 rounded-full border-2 border-navy/25 bg-cream-dark"
                    aria-hidden="true"
                  />
                  <TransactionRow transaction={transaction} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
