"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardPen, ClipboardPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MobileLocation, PurchaseDetail, PurchaseListItem, RequisitionDetail, RequisitionListItem } from "@/lib/types";
import { FilterChip } from "../FilterChip";
import { PurchaseCard } from "../PurchaseCard";
import { PurchaseDetailModal } from "../PurchaseDetailModal";
import { NewPurchaseModal } from "../purchases/NewPurchaseModal";
import { NewRequisitionModal } from "../requisitions/NewRequisitionModal";
import { RequisitionCard, requisitionStage } from "../requisitions/RequisitionCard";
import { RequisitionDetailModal } from "../requisitions/RequisitionDetailModal";

const ALL_FILTER = "__all__";
const MAIN_STORE_TYPE = "distribution_center";

type Stage = "all" | "requisition" | "draft" | "ordered" | "received" | "closed";

const STAGES: Array<{ value: Stage; label: string; purchasesOnly?: boolean }> = [
  { value: "all", label: "All" },
  { value: "requisition", label: "Requisitions" },
  { value: "draft", label: "Draft", purchasesOnly: true },
  { value: "ordered", label: "Ordered" },
  { value: "received", label: "Received" },
  { value: "closed", label: "Closed" },
];

/** Which stage chip a purchase falls under ("Received" covers partially received too). */
function purchaseStageOf(status: string): Stage {
  if (status === "draft") return "draft";
  if (status === "ordered") return "ordered";
  if (status === "partially_received" || status === "received") return "received";
  return "closed";
}

function requisitionStageOf(requisition: RequisitionListItem): Stage {
  const stage = requisitionStage(requisition);
  if (stage === "requisition") return "requisition";
  if (stage === "rejected" || stage === "cancelled") return "closed";
  return purchaseStageOf(stage === "approved" ? "ordered" : stage);
}

type Row =
  | { kind: "purchase"; at: string; purchase: PurchaseListItem }
  | { kind: "requisition"; at: string; requisition: RequisitionListItem };

/**
 * Purchases — one tab for the whole Requisition → Received document (client request). Requisitions
 * and purchases share one timeline: a requisition card reads "Requisition" until an approver turns it
 * into a purchase, after which the purchase card stands in for it ("from REQ-…"). Someone who can only
 * requisition (e.g. a Cashier) gets the same tab with everything purchase-side hidden — no suppliers,
 * costs or purchase cards; their requisitions show the stage they've reached.
 * With purchases.create there's New Purchase; with purchases.edit the purchase detail carries the
 * lifecycle actions (place order, receive goods, pay supplier, cancel).
 */
export function PurchasesTab({
  currency,
  canCreate,
  canEdit,
  canViewPurchases,
  canViewRequisitions,
  canCreateRequisition,
  canApproveRequisitions,
  canCreateProduct,
  viewerEmployeeId,
  vatRatePercent,
  viewerIsSuperAdmin,
  viewerBranchId,
}: {
  currency: string;
  canCreate: boolean;
  canEdit: boolean;
  canViewPurchases: boolean;
  canViewRequisitions: boolean;
  canCreateRequisition: boolean;
  canApproveRequisitions: boolean;
  canCreateProduct: boolean;
  viewerEmployeeId: string | null;
  vatRatePercent: number;
  viewerIsSuperAdmin: boolean;
  viewerBranchId: string | null;
}) {
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [loadedPurchases, setPurchases] = useState<PurchaseListItem[] | null>(null);
  const [loadedRequisitions, setRequisitions] = useState<RequisitionListItem[] | null>(null);
  // A role without one side simply has an empty list there — never fetched, never a spinner.
  const purchases = useMemo(() => (canViewPurchases ? loadedPurchases : []), [canViewPurchases, loadedPurchases]);
  const requisitions = useMemo(() => (canViewRequisitions ? loadedRequisitions : []), [canViewRequisitions, loadedRequisitions]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);
  const [stage, setStage] = useState<Stage>("all");
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingDraft, setEditingDraft] = useState<PurchaseDetail | null>(null);
  const [requisitionForm, setRequisitionForm] = useState<{ editing: RequisitionDetail | null } | null>(null);
  const [storefronts, setStorefronts] = useState<MobileLocation[] | null>(null);

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {
      // Filter chips just fall back to "All only" — not worth failing the whole tab over.
    });
  }, []);

  // Only someone without a storefront of their own picks one when raising a requisition.
  useEffect(() => {
    if (viewerBranchId || !canCreateRequisition) return;
    api.listStorefronts().then(setStorefronts).catch(() => setStorefronts([]));
  }, [viewerBranchId, canCreateRequisition]);

  const loadPurchases = useCallback(() => {
    if (!canViewPurchases) return;
    api
      .listPurchases(locationFilter === ALL_FILTER ? undefined : locationFilter)
      .then(setPurchases)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load purchases."));
  }, [locationFilter, canViewPurchases]);

  const loadRequisitions = useCallback(() => {
    if (!canViewRequisitions) return;
    api
      .listRequisitions()
      .then(setRequisitions)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load requisitions."));
  }, [canViewRequisitions]);

  useEffect(loadPurchases, [loadPurchases]);
  useEffect(loadRequisitions, [loadRequisitions]);

  const reloadAll = useCallback(() => {
    loadPurchases();
    loadRequisitions();
  }, [loadPurchases, loadRequisitions]);

  /** Clears the list on a filter change so the old storefront's rows never flash under the new chip. */
  function selectFilter(locationId: string): void {
    setPurchases(null);
    setError(null);
    setLocationFilter(locationId);
  }

  // Same rule SERVER applies: a branch-scoped employee receives into their own storefront or the
  // Main Store only.
  const receivingLocations = useMemo(() => {
    if (!locations) return [];
    const scope = viewerIsSuperAdmin ? null : viewerBranchId;
    return scope ? locations.filter((l) => l.id === scope || l.locationType === MAIN_STORE_TYPE) : locations;
  }, [locations, viewerIsSuperAdmin, viewerBranchId]);

  // Someone assigned to a location (Super Admins included) receives new stock there without being
  // asked — same as Checkout. A draft being edited keeps whatever it already had.
  const newPurchaseLocations = useMemo(() => {
    const own = receivingLocations.find((l) => l.id === viewerBranchId);
    return own ? [own] : receivingLocations;
  }, [receivingLocations, viewerBranchId]);

  const rows = useMemo<Row[] | null>(() => {
    if (!purchases || !requisitions) return null;
    const shownPurchaseIds = new Set(purchases.map((p) => p.id));
    const merged: Row[] = [];
    for (const purchase of purchases) {
      // "All" hides cancelled purchases, same as DESKTOP; "Closed" shows them.
      if (stage === "all" ? purchase.status === "cancelled" : purchaseStageOf(purchase.status) !== stage) continue;
      merged.push({ kind: "purchase", at: purchase.createdAt, purchase });
    }
    for (const requisition of requisitions) {
      // An approved requisition IS its purchase from here on — the purchase card stands in for it.
      if (requisition.purchaseId && shownPurchaseIds.has(requisition.purchaseId)) continue;
      if (locationFilter !== ALL_FILTER && requisition.storefrontId !== locationFilter) continue;
      if (stage === "all" ? requisition.status === "cancelled" : requisitionStageOf(requisition) !== stage) continue;
      merged.push({ kind: "requisition", at: requisition.requestedAt, requisition });
    }
    return merged.sort((a, b) => b.at.localeCompare(a.at));
  }, [purchases, requisitions, stage, locationFilter]);

  const pendingCount = (requisitions ?? []).filter((r) => r.status === "pending").length;
  const selectedRequisition = (requisitions ?? []).find((r) => r.id === selectedRequisitionId) ?? null;
  const showNewPurchase = canCreate && locations !== null;

  return (
    <div className="pb-10">
      {locations && locations.length > 1 && (
        <div className="sticky top-[60px] z-10 flex gap-1.5 overflow-x-auto border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip label="All" active={locationFilter === ALL_FILTER} onClick={() => selectFilter(ALL_FILTER)} />
          {locations.map((location) => (
            <FilterChip
              key={location.id}
              label={location.locationName}
              active={locationFilter === location.id}
              onClick={() => selectFilter(location.id)}
            />
          ))}
        </div>
      )}

      <div className="px-4 py-4">
        <div className="mb-3 flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STAGES.filter((s) => canViewPurchases || !s.purchasesOnly).map((s) => (
            <FilterChip
              key={s.value}
              label={s.value === "requisition" && pendingCount > 0 ? `${s.label} (${pendingCount})` : s.label}
              active={stage === s.value}
              onClick={() => setStage(s.value)}
            />
          ))}
        </div>

        {(canCreateRequisition || showNewPurchase) && (
          <div className={`mb-4 grid gap-2 ${canCreateRequisition && showNewPurchase ? "grid-cols-2" : "grid-cols-1"}`}>
            {canCreateRequisition && (
              <button
                type="button"
                onClick={() => setRequisitionForm({ editing: null })}
                className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold ${
                  showNewPurchase ? "border border-navy/20 text-navy" : "bg-blue text-white"
                }`}
              >
                <ClipboardPen className="size-4" aria-hidden="true" />
                New Requisition
              </button>
            )}
            {showNewPurchase && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white"
              >
                <ClipboardPlus className="size-4" aria-hidden="true" />
                New Purchase
              </button>
            )}
          </div>
        )}
        {notice && <p className="mb-3 rounded border border-green/30 bg-green/10 px-4 py-3 text-sm font-semibold text-green">{notice}</p>}
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!rows && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {rows && rows.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/50">{stage === "all" ? "Nothing here yet." : "Nothing at this stage."}</p>
        )}

        {rows && rows.length > 0 && (
          <div className="relative">
            <div
              className="pointer-events-none absolute top-2 bottom-2 left-3 border-l-2 border-dashed border-navy/20"
              aria-hidden="true"
            />
            <div className="space-y-3 pl-7">
              {rows.map((row) => (
                <div key={row.kind === "purchase" ? row.purchase.id : row.requisition.id} className="relative">
                  <span
                    className="pointer-events-none absolute top-9 -left-[19px] size-2 -translate-y-1/2 rounded-full border-2 border-navy/25 bg-cream-dark"
                    aria-hidden="true"
                  />
                  {row.kind === "purchase" ? (
                    <PurchaseCard purchase={row.purchase} onSelect={() => setSelectedPurchaseId(row.purchase.id)} />
                  ) : (
                    <RequisitionCard requisition={row.requisition} onSelect={() => setSelectedRequisitionId(row.requisition.id)} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedPurchaseId && (
        <PurchaseDetailModal
          purchaseId={selectedPurchaseId}
          canEdit={canEdit}
          onClose={() => setSelectedPurchaseId(null)}
          onChanged={reloadAll}
          onEditDraft={(purchase) => {
            setSelectedPurchaseId(null);
            setEditingDraft(purchase);
          }}
        />
      )}
      {(creating || editingDraft) && (
        <NewPurchaseModal
          locations={editingDraft ? receivingLocations : newPurchaseLocations}
          currency={currency}
          editing={editingDraft}
          onClose={() => {
            setCreating(false);
            setEditingDraft(null);
          }}
          onCreated={(purchaseId) => {
            setCreating(false);
            setEditingDraft(null);
            reloadAll();
            // Straight into the new PO — the next step (receive goods) usually follows right away.
            setSelectedPurchaseId(purchaseId);
          }}
        />
      )}

      {requisitionForm && (
        <NewRequisitionModal
          storefronts={viewerBranchId ? null : (storefronts ?? [])}
          editing={requisitionForm.editing}
          onClose={() => setRequisitionForm(null)}
          onCreated={(number) => {
            setNotice(requisitionForm.editing ? `${number} updated.` : `${number} sent for approval.`);
            setRequisitionForm(null);
            reloadAll();
          }}
        />
      )}
      {selectedRequisitionId && (
        <RequisitionDetailModal
          requisitionId={selectedRequisitionId}
          currency={currency}
          viewerEmployeeId={viewerEmployeeId}
          viewerIsSuperAdmin={viewerIsSuperAdmin}
          viewerBranchId={viewerBranchId}
          vatRatePercent={vatRatePercent}
          canApprove={canApproveRequisitions}
          canCreatePurchase={canCreate}
          canCreateProduct={canCreateProduct}
          onClose={() => setSelectedRequisitionId(null)}
          onChanged={reloadAll}
          onOpenPurchases={() => {
            // The requisition became this purchase — open it right here (purchase viewers only).
            const purchaseId = selectedRequisition?.purchaseId;
            if (!purchaseId || !canViewPurchases) return;
            setSelectedRequisitionId(null);
            setSelectedPurchaseId(purchaseId);
          }}
          onEdit={(requisition) => {
            setSelectedRequisitionId(null);
            setRequisitionForm({ editing: requisition });
          }}
        />
      )}
    </div>
  );
}
