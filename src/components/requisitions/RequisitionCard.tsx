"use client";

import { ClipboardPen, Store } from "lucide-react";
import type { RequisitionListItem } from "@/lib/types";
import { formatDate } from "./requisition-ui";

const STAGE_TONE: Record<string, string> = {
  requisition: "border-gold text-gold-text",
  rejected: "border-red text-red",
  cancelled: "border-navy/30 text-navy/50",
  draft: "border-navy/30 text-navy/50",
  ordered: "border-blue text-blue",
  partially_received: "border-gold text-gold-text",
  received: "border-green text-green",
  approved: "border-green text-green",
};

/** Where a requisition sits in the one-document lifecycle. Once approved it IS its purchase, so it
 * shows that purchase's stage — what a requisition-only viewer (who never sees the purchase card) sees. */
export function requisitionStage(requisition: RequisitionListItem): string {
  if (requisition.status === "pending") return "requisition";
  if (requisition.status !== "approved") return requisition.status;
  return requisition.purchaseStatus ?? "approved";
}

/** A requisition in the merged Purchases list — same shape as PurchaseCard, labelled "Requisition"
 * until it's approved. */
export function RequisitionCard({ requisition, onSelect }: { requisition: RequisitionListItem; onSelect: () => void }) {
  const stage = requisitionStage(requisition);
  return (
    <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 rounded-lg bg-white p-4 text-left shadow-sm">
      <div className="grid size-11 flex-none place-items-center rounded-full bg-gold text-white">
        <ClipboardPen className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-bold text-navy">{requisition.requisitionNumber}</p>
          <span
            className={`flex-none rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${STAGE_TONE[stage] ?? "border-navy/30 text-navy/50"}`}
          >
            {stage.replace(/_/g, " ")}
          </span>
        </div>
        <p className="truncate text-xs text-navy/50">
          {requisition.requestedByName} · {formatDate(requisition.requestedAt)}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-bold text-blue">
          <Store className="size-3.5 flex-none" aria-hidden="true" />
          {requisition.storefrontName}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-navy/60">
          {requisition.itemCount} item{requisition.itemCount === 1 ? "" : "s"} · {requisition.totalQuantityRequested} unit
          {requisition.totalQuantityRequested === 1 ? "" : "s"}
          {requisition.status === "pending" && requisition.unlinkedItemCount > 0 && (
            <span className="text-blue"> · {requisition.unlinkedItemCount} new</span>
          )}
          {requisition.purchaseNumber && <span className="text-green"> · {requisition.purchaseNumber}</span>}
        </p>
      </div>
    </button>
  );
}
