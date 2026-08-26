"use client";

import { FileText, Store, User } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { InvoiceListItem } from "@/lib/types";

const STATUS_TONE: Record<string, string> = {
  paid: "border-green text-green",
  overdue: "border-red text-red",
  partially_paid: "border-gold text-gold-text",
  unpaid: "border-blue text-blue",
  cancelled: "border-navy/30 text-navy/50",
};

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

/** Same "good info at a glance" job as SaleCard, but an invoice's most actionable fact is its status
 * and balance, not just its total — so those get top-right billing instead of a delivery pill. */
export function InvoiceCard({ invoice, onSelect }: { invoice: InvoiceListItem; onSelect: () => void }) {
  const statusTone = STATUS_TONE[invoice.paymentStatus] ?? "border-navy/30 text-navy/50";

  return (
    <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 rounded-lg bg-white p-4 text-left shadow-sm">
      <div className="grid size-11 flex-none place-items-center rounded-full bg-navy text-white">
        <FileText className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="break-words font-bold text-navy">{invoice.invoiceNumber ?? "Invoice"}</p>
          <p className="flex-none font-display text-sm text-navy">{formatCents(invoice.grandTotalCents, invoice.currency)}</p>
        </div>
        <p className="text-xs text-navy/50">Due {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"}</p>
        <p className="text-xs text-navy/50">{invoice.employeeName}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-blue">
          <Store className="size-3.5 flex-none" aria-hidden="true" />
          <span className="break-words">{invoice.locationName}</span>
        </p>
        {invoice.customerName && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-navy/50">
            <User className="size-3.5 flex-none" aria-hidden="true" />
            <span className="break-words">{invoice.customerName}</span>
          </p>
        )}
      </div>
      <div className="flex flex-none flex-col items-end gap-1">
        <span className={`rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${statusTone}`}>
          {formatStatus(invoice.paymentStatus)}
        </span>
        {invoice.balanceDueCents > 0 && (
          <span className="text-[10px] font-bold text-red">{formatCents(invoice.balanceDueCents, invoice.currency)} due</span>
        )}
      </div>
    </button>
  );
}
