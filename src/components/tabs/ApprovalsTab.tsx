"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { InvoiceCancellationApprovalItem } from "@/lib/types";
import { ApprovalCard } from "../ApprovalCard";
import { ApprovalDecisionModal } from "../ApprovalDecisionModal";

/** Every invoice-cancellation request still awaiting a decision, tenant-wide (not location-filtered
 * — an approver needs to see requests from every storefront, same as DESKTOP's own Approvals inbox).
 * Same dashed-timeline list pattern as InvoicesTab/SalesTab. */
export function ApprovalsTab() {
  const [items, setItems] = useState<InvoiceCancellationApprovalItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InvoiceCancellationApprovalItem | null>(null);

  function refresh(): void {
    setError(null);
    api
      .listPendingInvoiceCancellations()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load pending approvals."));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur">
        <p className="text-xs font-bold text-navy/50">Pending Cancellation Requests</p>
      </div>

      <div className="px-4 py-4">
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!items && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {items && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <CheckCircle2 className="size-6 text-navy/25" aria-hidden="true" />
            <p className="text-sm text-navy/50">No pending requests — you&apos;re all caught up.</p>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="relative">
            <div className="pointer-events-none absolute top-2 bottom-2 left-3 border-l-2 border-dashed border-navy/20" aria-hidden="true" />
            <div className="space-y-3 pl-7">
              {items.map((item) => (
                <div key={item.id} className="relative">
                  <span
                    className="pointer-events-none absolute top-9 -left-[19px] size-2 -translate-y-1/2 rounded-full border-2 border-navy/25 bg-cream-dark"
                    aria-hidden="true"
                  />
                  <ApprovalCard item={item} onSelect={() => setSelected(item)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <ApprovalDecisionModal
          item={selected}
          onClose={() => setSelected(null)}
          onDecided={() => {
            setSelected(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
