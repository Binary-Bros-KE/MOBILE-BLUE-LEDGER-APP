"use client";

import { useEffect, useState } from "react";
import { Ban, CheckCircle2, ChevronRight, FileX2, Undo2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { InvoiceCancellationApprovalItem, RecentApprovalDecision } from "@/lib/types";
import { ApprovalCard } from "../ApprovalCard";
import { ApprovalDecisionModal } from "../ApprovalDecisionModal";
import { DocumentDetailModal } from "../DocumentDetailModal";
import { SaleAdjustmentApprovals } from "../SaleAdjustmentApprovals";

/** Void and return requests (SaleAdjustmentApprovals) and every invoice-cancellation request still
 * awaiting a decision. Cancellations: tenant-wide (not location-filtered
 * — an approver needs to see requests from every storefront, same as DESKTOP's own Approvals inbox).
 * Same dashed-timeline list pattern as InvoicesTab/SalesTab. */
export function ApprovalsTab() {
  const [items, setItems] = useState<InvoiceCancellationApprovalItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InvoiceCancellationApprovalItem | null>(null);
  const [recent, setRecent] = useState<RecentApprovalDecision[] | null>(null);
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);

  function loadRecent(): void {
    api
      .listRecentApprovalDecisions()
      .then(setRecent)
      .catch(() => setRecent([]));
  }

  function load(): void {
    api
      .listPendingInvoiceCancellations()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load pending approvals."));
    loadRecent();
  }

  function refresh(): void {
    setError(null);
    load();
  }

  useEffect(load, []);

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur">
        <p className="text-xs font-bold text-navy/50">Pending Approvals</p>
      </div>

      <div className="px-4 py-4">
        <SaleAdjustmentApprovals onDecided={loadRecent} />
        {items && items.length > 0 && <p className="mb-2 text-xs font-bold text-navy/50">Invoice Cancellations</p>}
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

        {recent && recent.length > 0 && (
          <section className="mt-6">
            <p className="mb-2 text-xs font-bold text-navy/50">Recent Decisions</p>
            <div className="space-y-2">
              {recent.map((entry) => (
                <RecentDecisionRow key={`${entry.kind}-${entry.id}`} entry={entry} onOpen={() => setOpenSaleId(entry.saleId)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {openSaleId && <DocumentDetailModal saleId={openSaleId} onClose={() => setOpenSaleId(null)} />}

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

const KIND_LABEL: Record<RecentApprovalDecision["kind"], string> = { void: "Void", return: "Return", invoice_cancellation: "Cancellation" };
const KIND_ICON = { void: Ban, return: Undo2, invoice_cancellation: FileX2 } as const;

/** One decided request — tap to open the receipt/invoice it was about (DESKTOP's eye button). */
function RecentDecisionRow({ entry, onOpen }: { entry: RecentApprovalDecision; onOpen: () => void }) {
  const Icon = KIND_ICON[entry.kind];
  const approved = entry.status === "approved";
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-left shadow-sm active:bg-cream-dark">
      <Icon className="size-4 flex-none text-navy/40" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-navy">
          {KIND_LABEL[entry.kind]} · {entry.documentNumber ?? "—"}
        </p>
        <p className="truncate text-[11px] text-navy/50">{entry.reason}</p>
        <p className="truncate text-[11px] text-navy/40">
          {entry.decidedByName ?? "—"}
          {entry.decidedAt ? ` · ${new Date(entry.decidedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}
          {entry.locationName ? ` · ${entry.locationName}` : ""}
        </p>
      </div>
      <span
        className={`flex-none rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
          approved ? "border-green text-green" : "border-navy/30 text-navy/50"
        }`}
      >
        {approved ? "Approved" : "Rejected"}
      </span>
      <ChevronRight className="size-4 flex-none text-navy/30" aria-hidden="true" />
    </button>
  );
}
