"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import type { MobileCustomer } from "@/lib/types";
import { QuickCreateCustomerModal } from "../QuickCreateCustomerModal";

/** Mirrors DESKTOP's own Choose Customer modal (CheckoutRoute.tsx) exactly — search by name/phone/
 * customerCode, "Walk-in Customer" as the default/no-selection choice, "+ New Customer" quick-create
 * inline. */
export function CheckoutCustomerPickerModal({
  customers,
  selectedCustomerId,
  onSelect,
  onCustomerCreated,
  onClose,
}: {
  customers: MobileCustomer[];
  selectedCustomerId: string | null;
  onSelect: (customerId: string | null) => void;
  onCustomerCreated: (customer: MobileCustomer) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers.slice(0, 30);
    return customers.filter((c) => `${c.name} ${c.phone} ${c.customerCode}`.toLowerCase().includes(term)).slice(0, 30);
  }, [customers, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <p className="font-display text-lg text-navy">Choose Customer</p>
            <p className="text-xs text-navy/50">Search by name or phone — or keep it a walk-in sale.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
              <input
                autoFocus
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
              className="flex flex-none items-center gap-1 text-[11px] font-extrabold uppercase text-blue"
            >
              <Plus className="size-3" aria-hidden="true" />
              New
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-5 pb-5">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left ${
              !selectedCustomerId ? "border-blue bg-blue/10" : "border-navy/15 hover:bg-cream-dark"
            }`}
          >
            <span className="text-sm font-bold text-navy">Walk-in Customer</span>
            <span className="rounded-full border border-dashed border-navy/25 px-2 py-0.5 text-[10px] font-bold text-navy/50">Default</span>
          </button>

          {filtered.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => onSelect(customer.id)}
              className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left ${
                selectedCustomerId === customer.id ? "border-blue bg-blue/10" : "border-navy/15 hover:bg-cream-dark"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy">{customer.name}</p>
                <p className="text-[11px] text-navy/50">{customer.phone}</p>
              </div>
              <span className="flex-none rounded-full border border-dashed border-navy/25 px-2 py-0.5 text-[10px] font-bold text-navy/60">
                {customer.customerCode}
              </span>
            </button>
          ))}

          {filtered.length === 0 && <p className="py-6 text-center text-xs font-semibold text-navy/40">No customers match your search</p>}
        </div>
      </motion.div>

      {createOpen && (
        <QuickCreateCustomerModal
          onClose={() => setCreateOpen(false)}
          onCreated={(customer) => {
            onCustomerCreated(customer);
            onSelect(customer.id);
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}
