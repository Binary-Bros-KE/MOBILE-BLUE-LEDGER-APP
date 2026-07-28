"use client";

import { Receipt, Store, User } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { SaleListItem } from "@/lib/types";

/** The list card's whole job is "good info at a glance" — date/time, who recorded it, which
 * storefront, the amount — tapping it opens the full document in SaleDetailModal for view/download/
 * share. No inline accordion here (unlike EmployeeCard) since a receipt has more to show than fits
 * comfortably inline, and Download/Share need real room to work with. */
export function SaleCard({ sale, onSelect }: { sale: SaleListItem; onSelect: () => void }) {
  const dateLabel = new Date(sale.completedAt ?? sale.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 rounded-lg bg-white p-4 text-left shadow-sm">
      <div className="grid size-11 flex-none place-items-center rounded-full bg-navy text-white">
        <Receipt className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-bold text-navy">{sale.receiptNumber ?? "Receipt"}</p>
          <p className="flex-none font-display text-sm text-navy">{formatCents(sale.grandTotalCents, sale.currency)}</p>
        </div>
        <p className="truncate text-xs text-navy/50">
          {dateLabel} · {sale.employeeName}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-bold text-blue">
          <Store className="size-3.5 flex-none" aria-hidden="true" />
          {sale.locationName}
        </p>
        {sale.customerName && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-navy/50">
            <User className="size-3.5 flex-none" aria-hidden="true" />
            {sale.customerName}
          </p>
        )}
      </div>
      {sale.hasDeliveryNote && (
        <span className="flex-none rounded-full border border-dashed border-green/40 bg-green/5 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-green uppercase">
          Delivery
        </span>
      )}
    </button>
  );
}
