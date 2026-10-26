"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Phone, Plus, Search, Truck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { MobileSupplierWithBalance } from "@/lib/types";
import { QuickCreateSupplierModal } from "../QuickCreateSupplierModal";
import { SupplierBalanceModal } from "../suppliers/SupplierBalanceModal";

/** Supplier directory with what's owed to each — biggest balance first. Tap a supplier for its
 * balance history and (suppliers.edit) Adjust Balance. Same grants as DESKTOP's Suppliers screen. */
export function SuppliersTab({ currency, canCreate, canAdjust }: { currency: string; canCreate: boolean; canAdjust: boolean }) {
  const [suppliers, setSuppliers] = useState<MobileSupplierWithBalance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<MobileSupplierWithBalance | null>(null);

  const loadSuppliers = useCallback(() => {
    api
      .listSupplierBalances()
      .then(setSuppliers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load suppliers."));
  }, []);

  useEffect(loadSuppliers, [loadSuppliers]);

  const totalOwedCents = useMemo(() => (suppliers ?? []).reduce((sum, s) => sum + Math.max(0, s.balanceCents), 0), [suppliers]);

  const filtered = useMemo(() => {
    if (!suppliers) return null;
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter((s) => `${s.businessName} ${s.phone1} ${s.supplierCode}`.toLowerCase().includes(term));
  }, [suppliers, search]);

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 flex items-center gap-2 border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="w-full rounded-lg border border-navy/15 bg-white py-2 pr-3 pl-9 text-sm text-navy placeholder:text-navy/30 focus:border-blue focus:outline-none"
          />
        </div>
        {canCreate && (
          <button type="button" onClick={() => setCreateOpen(true)} className="flex flex-none items-center gap-1 rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white">
            <Plus className="size-3.5" aria-hidden="true" />
            New
          </button>
        )}
      </div>

      <div className="px-4 py-4">
        {totalOwedCents > 0 && (
          <p className="mb-3 text-xs text-navy/60">
            We owe suppliers <span className="font-bold text-red">{formatCents(totalOwedCents, currency)}</span>
          </p>
        )}
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!suppliers && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {filtered && filtered.length === 0 && <p className="py-10 text-center text-sm text-navy/50">No suppliers match.</p>}

        {filtered && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((supplier) => (
              <button
                key={supplier.id}
                type="button"
                onClick={() => setSelected(supplier)}
                className="flex w-full items-center gap-3 rounded-lg bg-white p-3 text-left shadow-sm"
              >
                <div className="grid size-10 flex-none place-items-center rounded-full bg-navy/10 text-navy">
                  <Truck className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-navy">{supplier.businessName}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-navy/50">
                    <Phone className="size-3 flex-none" aria-hidden="true" />
                    {supplier.phone1}
                  </p>
                </div>
                {supplier.balanceCents !== 0 ? (
                  <span className={`flex-none font-display text-sm ${supplier.balanceCents > 0 ? "text-red" : "text-green"}`}>
                    {formatCents(Math.abs(supplier.balanceCents), currency)}
                  </span>
                ) : (
                  <span className="flex-none rounded-full border border-dashed border-navy/25 px-2 py-0.5 text-[10px] font-bold text-navy/60">
                    {supplier.supplierCode}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <QuickCreateSupplierModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            loadSuppliers();
          }}
        />
      )}
      {selected && (
        <SupplierBalanceModal supplier={selected} currency={currency} canAdjust={canAdjust} onClose={() => setSelected(null)} onChanged={loadSuppliers} />
      )}
    </div>
  );
}
