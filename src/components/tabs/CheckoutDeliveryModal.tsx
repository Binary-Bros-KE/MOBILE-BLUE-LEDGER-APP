"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Truck, X } from "lucide-react";
import type { MobileRider } from "@/lib/types";
import { QuickCreateRiderModal } from "../QuickCreateRiderModal";

/** fee/cost are kept as the raw text the cashier typed (currency units, e.g. "250.00"), not cents —
 * converting through cents on every keystroke fights typing, same reasoning as CheckoutTab's own
 * discount/amount-received fields. Mirrors DESKTOP's own ExtraChargesSection DeliveryDraft shape. */
export type DeliveryDraft = {
  riderId: string | null;
  recipientName: string;
  country: string;
  town: string;
  physicalAddress: string;
  notes: string;
  fee: string;
  cost: string;
};

export function emptyDeliveryDraft(recipientName: string): DeliveryDraft {
  return { riderId: null, recipientName, country: "", town: "", physicalAddress: "", notes: "", fee: "", cost: "" };
}

/** A MODAL rather than DESKTOP's inline expanding panel (ExtraChargesSection) — mobile screen space
 * is tight, and a cashier adding delivery mid-sale benefits more from a focused full-screen form than
 * a growing scroll. Same fields as DESKTOP though: recipient/rider/address/notes/fee/cost, folding
 * fee into the sale's grand total (see CheckoutTab's grandTotalCents) — cost is internal-only, never
 * shown on the receipt. */
export function CheckoutDeliveryModal({
  initialDraft,
  riders,
  onRiderCreated,
  onSave,
  onRemove,
  onClose,
}: {
  initialDraft: DeliveryDraft;
  riders: MobileRider[];
  onRiderCreated: (rider: MobileRider) => void;
  onSave: (draft: DeliveryDraft) => void;
  onRemove: (() => void) | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<DeliveryDraft>(initialDraft);
  const [riderModalOpen, setRiderModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(patch: Partial<DeliveryDraft>): void {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function handleSave(e: React.FormEvent): void {
    e.preventDefault();
    if (!draft.recipientName.trim() || !draft.physicalAddress.trim()) {
      setError("Recipient name and delivery address are required.");
      return;
    }
    onSave(draft);
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
              <Truck className="size-4 text-blue" aria-hidden="true" />
              Delivery Details
            </p>
            <p className="text-xs text-navy/50">Fee is added to this sale's total.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          {error && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{error}</p>}

          <label className="block">
            <span className="text-[11px] font-semibold text-navy/50">Recipient Name</span>
            <input
              autoFocus
              type="text"
              value={draft.recipientName}
              onChange={(e) => update({ recipientName: e.target.value })}
              placeholder="Who is receiving this?"
              className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
            />
          </label>

          <div>
            <span className="text-[11px] font-semibold text-navy/50">Rider</span>
            <div className="mt-1 flex gap-1.5">
              <select
                value={draft.riderId ?? ""}
                onChange={(e) => update({ riderId: e.target.value || null })}
                className="h-10 w-full rounded-lg border border-navy/15 bg-white px-3 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
              >
                <option value="">Select a rider…</option>
                {riders.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setRiderModalOpen(true)}
                className="grid h-10 w-10 flex-none place-items-center rounded-lg border border-navy/15 text-navy/60"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] font-semibold text-navy/50">Country</span>
              <input
                type="text"
                value={draft.country}
                onChange={(e) => update({ country: e.target.value })}
                placeholder="e.g. Kenya"
                className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-navy/50">Town</span>
              <input
                type="text"
                value={draft.town}
                onChange={(e) => update({ town: e.target.value })}
                placeholder="e.g. Westlands"
                className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold text-navy/50">Physical Address</span>
            <input
              type="text"
              value={draft.physicalAddress}
              onChange={(e) => update({ physicalAddress: e.target.value })}
              placeholder="Delivery address"
              className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold text-navy/50">Delivery Notes</span>
            <textarea
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Optional delivery instructions"
              rows={2}
              className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] font-semibold text-navy/50">Delivery Fee</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.fee}
                onChange={(e) => update({ fee: e.target.value })}
                placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-right text-sm font-semibold text-navy focus:border-blue focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-navy/50">Delivery Cost</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.cost}
                onChange={(e) => update({ cost: e.target.value })}
                placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-right text-sm font-semibold text-navy focus:border-blue focus:outline-none"
              />
            </label>
          </div>
          <p className="text-[10px] font-semibold text-navy/40">Cost is internal-only — never shown on the receipt.</p>

          <div className="flex items-center gap-2 pt-2">
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="flex flex-none items-center gap-1.5 rounded-lg border border-red/30 px-3 py-3 text-xs font-bold text-red"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </button>
            )}
            <button type="submit" className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white">
              Save Delivery
            </button>
          </div>
        </form>
      </motion.div>

      {riderModalOpen && (
        <QuickCreateRiderModal
          onClose={() => setRiderModalOpen(false)}
          onCreated={(rider) => {
            onRiderCreated(rider);
            update({ riderId: rider.id });
            setRiderModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
