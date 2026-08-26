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
          <p className="break-words font-bold text-navy">{sale.receiptNumber ?? "Receipt"}</p>
          <p className="flex-none font-display text-sm text-navy">{formatCents(sale.grandTotalCents, sale.currency)}</p>
        </div>
        <p className="text-xs text-navy/50">{dateLabel}</p>
        <p className="text-xs text-navy/50">{sale.employeeName}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-blue">
          <Store className="size-3.5 flex-none" aria-hidden="true" />
          <span className="break-words">{sale.locationName}</span>
        </p>
        {sale.customerName && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-navy/50">
            <User className="size-3.5 flex-none" aria-hidden="true" />
            <span className="break-words">{sale.customerName}</span>
          </p>
        )}
      </div>
      <div className="flex flex-none flex-col items-end gap-1">
        {sale.hasDeliveryNote && (
          <span
            className={`rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
              sale.deliveryIsDelivered ? "border-green/40 bg-green/5 text-green" : "border-gold/40 bg-gold/5 text-gold-text"
            }`}
          >
            {sale.deliveryIsDelivered ? "Delivered" : "Pending Delivery"}
          </span>
        )}
        {sale.approvedVoid && (
          <span className="rounded-full border border-dashed border-red/40 bg-red/5 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-red uppercase">
            Voided
          </span>
        )}
        {sale.approvedReturn && (
          <span className="rounded-full border border-dashed border-gold/40 bg-gold/5 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-gold-text uppercase">
            Returned
          </span>
        )}
        {(sale.pendingVoid || sale.pendingReturn) && (
          <span className="rounded-full border border-dashed border-blue/40 bg-blue/5 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-blue uppercase">
            Pending Approval
          </span>
        )}
        {(sale.rejectedVoid || sale.rejectedReturn) && (
          <span className="rounded-full border border-dashed border-navy/20 bg-navy/5 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-navy/50 uppercase">
            {sale.rejectedVoid ? "Void Rejected" : "Return Rejected"}
          </span>
        )}
      </div>
    </button>
  );
}
