"use client";

import { Store, Truck } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { PurchaseListItem } from "@/lib/types";

const STATUS_TONE: Record<string, string> = {
  draft: "border-navy/30 text-navy/50",
  ordered: "border-blue text-blue",
  partially_received: "border-gold text-gold-text",
  received: "border-green text-green",
  cancelled: "border-red text-red",
};

const PAYMENT_TONE: Record<string, string> = {
  unpaid: "text-red",
  partially_paid: "text-gold-text",
  paid: "text-green",
};

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function PurchaseCard({ purchase, onSelect }: { purchase: PurchaseListItem; onSelect: () => void }) {
  const statusTone = STATUS_TONE[purchase.status] ?? "border-navy/30 text-navy/50";
  const paymentTone = PAYMENT_TONE[purchase.paymentStatus] ?? "text-navy/50";

  return (
    <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 rounded-lg bg-white p-4 text-left shadow-sm">
      <div className="grid size-11 flex-none place-items-center rounded-full bg-navy text-white">
        <Truck className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-bold text-navy">{purchase.purchaseNumber}</p>
          <p className="flex-none font-display text-sm text-navy">{formatCents(purchase.grandTotalCents, purchase.currency)}</p>
        </div>
        <p className="truncate text-xs text-navy/50">{purchase.supplierName}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-bold text-blue">
          <Store className="size-3.5 flex-none" aria-hidden="true" />
          {purchase.locationName}
        </p>
        <p className={`mt-0.5 text-[11px] font-bold uppercase tracking-wide ${paymentTone}`}>
          {formatStatus(purchase.paymentStatus)} · {formatCents(purchase.amountPaidCents, purchase.currency)} paid
        </p>
      </div>
      <span className={`flex-none rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${statusTone}`}>
        {formatStatus(purchase.status)}
      </span>
    </button>
  );
}
