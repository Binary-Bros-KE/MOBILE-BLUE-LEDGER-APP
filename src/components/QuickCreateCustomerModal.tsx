"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MobileCustomer } from "@/lib/types";

/** The fast path for adding a customer mid-sale — only name and phone, matching DESKTOP's own
 * QuickCreateCustomerModal exactly (everything else is editable later from DESKTOP's Customers
 * screen; mobile has no full customer-edit UI in this phase). */
export function QuickCreateCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (customer: MobileCustomer) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const customer = await api.createCustomer({ name: name.trim(), phone: phone.trim() });
      onCreated(customer);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-display text-lg text-navy">New Customer</p>
            <p className="text-xs text-navy/50">Just enough to use them right now.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{error}</p>}
          <label className="block">
            <span className="text-[11px] font-semibold text-navy/50">Name</span>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Wanjiru"
              required
              className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-navy/50">Phone</span>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0712 345 678"
              required
              className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {saving ? "Creating…" : "Create Customer"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
