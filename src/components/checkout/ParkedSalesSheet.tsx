"use client";

import { Play, Trash2 } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { ParkedSale } from "@/lib/parked-sales";
import { BottomSheet } from "../BottomSheet";

/** Carts parked on this phone at this storefront — tap one to resume it. If a cart is already in
 * progress, CheckoutTab parks it first, so resuming never throws anything away. */
export function ParkedSalesSheet({
  sales,
  currency,
  onResume,
  onDiscard,
  onClose,
}: {
  sales: ParkedSale[];
  currency: string;
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet title="Parked Sales" subtitle="Kept on this phone only." onClose={onClose}>
      {sales.length === 0 && <p className="py-8 text-center text-sm text-navy/50">No parked sales.</p>}
      <div className="space-y-2">
        {sales.map((sale) => {
          const items = sale.cart.reduce((sum, line) => sum + line.quantity, 0);
          // Preview only — the real total is recomputed by SERVER when the sale is completed.
          const previewCents = sale.cart.reduce((sum, line) => sum + line.unitPriceCents * line.quantity - line.discountAmountCents, 0);
          return (
            <div key={sale.id} className="flex items-center gap-2 rounded-lg border border-navy/15 p-3">
              <button type="button" onClick={() => onResume(sale.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="grid size-9 flex-none place-items-center rounded-full bg-blue text-white">
                  <Play className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-navy">{sale.label}</span>
                  <span className="block text-[11px] text-navy/50">
                    {items} item{items === 1 ? "" : "s"} · ~{formatCents(previewCents, currency)} ·{" "}
                    {new Date(sale.parkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              </button>
              <button type="button" onClick={() => onDiscard(sale.id)} aria-label={`Discard ${sale.label}`} className="grid size-8 flex-none place-items-center text-navy/30 hover:text-red">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}
