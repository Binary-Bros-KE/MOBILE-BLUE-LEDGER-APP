"use client";

import { FileText, Store } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { InvoiceCancellationApprovalItem } from "@/lib/types";

/** Same "good info at a glance" job as InvoiceCard — the reason is this card's most actionable
 * fact (why someone wants this cancelled), so it gets the description line InvoiceCard spends on
 * customer name instead. */
export function ApprovalCard({ item, onSelect }: { item: InvoiceCancellationApprovalItem; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 rounded-lg bg-white p-4 text-left shadow-sm">
      <div className="grid size-11 flex-none place-items-center rounded-full bg-red text-white">
        <FileText className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-bold text-navy">{item.invoiceNumber ?? "Invoice"}</p>
          <p className="flex-none font-display text-sm text-navy">{formatCents(item.saleGrandTotalCents, item.currency)}</p>
        </div>
        <p className="truncate text-xs text-navy/50">
          {new Date(item.requestedAt).toLocaleString()} · {item.requestedByName}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-bold text-blue">
          <Store className="size-3.5 flex-none" aria-hidden="true" />
          {item.locationName}
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-navy/70">{item.reason}</p>
      </div>
    </button>
  );
}
