"use client";

import { FileSpreadsheet, Store, User } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { QuotationListItem } from "@/lib/types";

const STATUS_TONE: Record<string, string> = {
  draft: "border-navy/30 text-navy/50",
  sent: "border-gold text-gold-text",
  accepted: "border-green text-green",
  rejected: "border-red text-red",
  expired: "border-red text-red",
  converted: "border-green text-green",
};

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

/** Same "good info at a glance" job as InvoiceCard, swapping balance-due for the quotation's own
 * lifecycle status (draft/sent/accepted/rejected/expired/converted) — a quotation's most actionable
 * fact is whether it's still open, not a running balance. */
export function QuotationCard({ quotation, onSelect }: { quotation: QuotationListItem; onSelect: () => void }) {
  const statusTone = STATUS_TONE[quotation.status] ?? "border-navy/30 text-navy/50";

  return (
    <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 rounded-lg bg-white p-4 text-left shadow-sm">
      <div className="grid size-11 flex-none place-items-center rounded-full bg-navy text-white">
        <FileSpreadsheet className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="break-words font-bold text-navy">{quotation.quotationNumber}</p>
          <p className="flex-none font-display text-sm text-navy">{formatCents(quotation.grandTotalCents, quotation.currency)}</p>
        </div>
        <p className="text-xs text-navy/50">Valid until {new Date(quotation.validUntil).toLocaleDateString()}</p>
        <p className="text-xs text-navy/50">{quotation.employeeName}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-blue">
          <Store className="size-3.5 flex-none" aria-hidden="true" />
          <span className="break-words">{quotation.locationName}</span>
        </p>
        {quotation.customerName && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-navy/50">
            <User className="size-3.5 flex-none" aria-hidden="true" />
            <span className="break-words">{quotation.customerName}</span>
          </p>
        )}
      </div>
      <span className={`flex-none rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${statusTone}`}>
        {formatStatus(quotation.status)}
      </span>
    </button>
  );
}
