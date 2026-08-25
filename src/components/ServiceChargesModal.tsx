"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Receipt, Trash2, X } from "lucide-react";
import type { ServiceChargeDraft } from "@/lib/types";

export function emptyServiceChargeDraft(): ServiceChargeDraft {
  return { name: "", fee: "", cost: "" };
}

/** Named ad-hoc fees (e.g. "Labour", "Installation") — unlimited rows, shared verbatim by Checkout
 * and the Invoice/Quotation forms so all three collect the exact same shape (see SERVER's
 * mobileServiceChargeSchema). A bottom-sheet modal like CheckoutDeliveryModal, but a repeatable list
 * rather than one fixed set of fields. */
export function ServiceChargesModal({
  initialDrafts,
  onSave,
  onClose,
}: {
  initialDrafts: ServiceChargeDraft[];
  onSave: (drafts: ServiceChargeDraft[]) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<ServiceChargeDraft[]>(initialDrafts.length > 0 ? initialDrafts : [emptyServiceChargeDraft()]);
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<ServiceChargeDraft>): void {
    setDrafts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow(): void {
    setDrafts((prev) => [...prev, emptyServiceChargeDraft()]);
  }

  function removeRow(index: number): void {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave(e: React.FormEvent): void {
    e.preventDefault();
    const halfFilled = drafts.some((row) => (row.name.trim() || row.fee.trim()) && (!row.name.trim() || !row.fee.trim()));
    if (halfFilled) {
      setError("Each charge needs both a name and a fee.");
      return;
    }
    onSave(drafts.filter((row) => row.name.trim() && row.fee.trim()));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="flex items-center gap-1.5 font-display text-lg text-navy">
              <Receipt className="size-4 text-blue" aria-hidden="true" />
              Service Charges
            </p>
            <p className="text-xs text-navy/50">Named fees are added to this document&apos;s total.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          {error && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{error}</p>}

          <div className="space-y-2.5">
            {drafts.map((row, index) => (
              <div key={index} className="rounded-lg border border-navy/10 bg-cream-dark/40 p-2.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateRow(index, { name: e.target.value })}
                    placeholder="e.g. Labour"
                    className="min-w-0 flex-1 rounded-md border border-navy/15 px-2.5 py-1.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    aria-label="Remove charge"
                    className="grid size-8 flex-none place-items-center rounded-md text-navy/30 hover:text-red"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <label className="block">
                    <span className="text-[10px] font-semibold text-navy/50">Fee</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.fee}
                      onChange={(e) => updateRow(index, { fee: e.target.value })}
                      placeholder="0.00"
                      className="mt-0.5 w-full rounded-md border border-navy/15 px-2 py-1.5 text-right text-xs font-semibold text-navy focus:border-blue focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-navy/50">Cost</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.cost}
                      onChange={(e) => updateRow(index, { cost: e.target.value })}
                      placeholder="0.00"
                      className="mt-0.5 w-full rounded-md border border-navy/15 px-2 py-1.5 text-right text-xs font-semibold text-navy focus:border-blue focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-navy/20 py-2 text-xs font-bold text-navy/60"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add another charge
          </button>

          <p className="text-[10px] font-semibold text-navy/40">Cost is internal-only — never shown on the receipt.</p>

          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white">
            Save Charges
          </button>
        </form>
      </motion.div>
    </div>
  );
}
