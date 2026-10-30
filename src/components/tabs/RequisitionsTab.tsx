"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardPen, Store } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MobileLocation, RequisitionListItem, RequisitionStatus } from "@/lib/types";
import { FilterChip } from "../FilterChip";
import { NewRequisitionModal } from "../requisitions/NewRequisitionModal";
import { RequisitionDetailModal } from "../requisitions/RequisitionDetailModal";
import { RequisitionStatusPill, formatDate } from "../requisitions/requisition-ui";

type Filter = "all" | RequisitionStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * Purchase requisitions — DESKTOP's Requisitions screen on the phone. Anyone with
 * purchase_requisitions.create raises one (catalog or free-text items); an approver reviews it here,
 * links new items to products, and approves it into a purchase (then receives the goods from
 * Purchases as usual) or rejects it. Branch staff see their own storefront's; an unassigned Super
 * Admin sees all and picks the storefront when raising one.
 */
export function RequisitionsTab({
  currency,
  viewerEmployeeId,
  viewerIsSuperAdmin,
  viewerBranchId,
  vatRatePercent,
  canCreate,
  canApprove,
  canCreatePurchase,
  canCreateProduct,
  onOpenPurchases,
}: {
  currency: string;
  viewerEmployeeId: string | null;
  viewerIsSuperAdmin: boolean;
  viewerBranchId: string | null;
  vatRatePercent: number;
  canCreate: boolean;
  canApprove: boolean;
  canCreatePurchase: boolean;
  canCreateProduct: boolean;
  onOpenPurchases: () => void;
}) {
  const [requisitions, setRequisitions] = useState<RequisitionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(canApprove ? "pending" : "all");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Only someone without a storefront of their own picks one (SERVER ignores it for everyone else).
  const [storefronts, setStorefronts] = useState<MobileLocation[] | null>(null);
  const needsStorefrontPicker = !viewerBranchId;

  const load = useCallback(() => {
    api
      .listRequisitions()
      .then((list) => {
        setRequisitions(list);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load requisitions."));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!needsStorefrontPicker || !canCreate) return;
    api.listStorefronts().then(setStorefronts).catch(() => setStorefronts([]));
  }, [needsStorefrontPicker, canCreate]);

  const pendingCount = useMemo(() => (requisitions ?? []).filter((r) => r.status === "pending").length, [requisitions]);
  const visible = useMemo(() => (requisitions ?? []).filter((r) => filter === "all" || r.status === filter), [requisitions, filter]);

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 flex gap-1.5 overflow-x-auto border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <FilterChip
            key={f.value}
            label={f.value === "pending" && pendingCount > 0 ? `${f.label} (${pendingCount})` : f.label}
            active={filter === f.value}
            onClick={() => setFilter(f.value)}
          />
        ))}
      </div>

      <div className="px-4 py-4">
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white"
          >
            <ClipboardPen className="size-4" aria-hidden="true" />
            New Requisition
          </button>
        )}
        {notice && <p className="mb-3 rounded border border-green/30 bg-green/10 px-4 py-3 text-sm font-semibold text-green">{notice}</p>}
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!requisitions && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {requisitions && visible.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/50">
            {requisitions.length === 0 ? "No requisitions yet." : `No ${filter} requisitions.`}
          </p>
        )}

        {visible.length > 0 && (
          <div className="space-y-3">
            {visible.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className="flex w-full items-start gap-3 rounded-lg bg-white p-4 text-left shadow-sm"
              >
                <div className="grid size-11 flex-none place-items-center rounded-full bg-navy text-white">
                  <ClipboardPen className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-bold text-navy">{r.requisitionNumber}</p>
                    <RequisitionStatusPill status={r.status} />
                  </div>
                  <p className="truncate text-xs text-navy/50">
                    {r.requestedByName} · {formatDate(r.requestedAt)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-bold text-blue">
                    <Store className="size-3.5 flex-none" aria-hidden="true" />
                    {r.storefrontName}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-navy/60">
                    {r.itemCount} item{r.itemCount === 1 ? "" : "s"} · {r.totalQuantityRequested} unit{r.totalQuantityRequested === 1 ? "" : "s"}
                    {r.status === "pending" && r.unlinkedItemCount > 0 && <span className="text-blue"> · {r.unlinkedItemCount} new</span>}
                    {r.purchaseNumber && (
                      <span className="text-green">
                        {" "}
                        · {r.purchaseNumber} {(r.purchaseStatus ?? "").replace(/_/g, " ")}
                      </span>
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <NewRequisitionModal
          storefronts={needsStorefrontPicker ? (storefronts ?? []) : null}
          onClose={() => setCreating(false)}
          onCreated={(number) => {
            setCreating(false);
            setNotice(`${number} sent for approval.`);
            load();
          }}
        />
      )}

      {selectedId && (
        <RequisitionDetailModal
          requisitionId={selectedId}
          currency={currency}
          viewerEmployeeId={viewerEmployeeId}
          viewerIsSuperAdmin={viewerIsSuperAdmin}
          viewerBranchId={viewerBranchId}
          vatRatePercent={vatRatePercent}
          canApprove={canApprove}
          canCreatePurchase={canCreatePurchase}
          canCreateProduct={canCreateProduct}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onOpenPurchases={onOpenPurchases}
        />
      )}
    </div>
  );
}
