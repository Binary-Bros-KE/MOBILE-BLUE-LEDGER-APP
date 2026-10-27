"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MobileLocation, PurchaseDetail, PurchaseListItem } from "@/lib/types";
import { FilterChip } from "../FilterChip";
import { PurchaseCard } from "../PurchaseCard";
import { PurchaseDetailModal } from "../PurchaseDetailModal";
import { NewPurchaseModal } from "../purchases/NewPurchaseModal";

const ALL_FILTER = "__all__";
const MAIN_STORE_TYPE = "distribution_center";

/** Same storefront-filter + dashed-timeline pattern as Sales/Invoices/Quotations. "View more" opens
 * PurchaseDetailModal (no Download/Share, since neither exists for Purchases anywhere in this app).
 * With purchases.create there's a New Purchase button; with purchases.edit the detail modal carries
 * the lifecycle actions (place order, receive goods, pay supplier, cancel). */
export function PurchasesTab({
  currency,
  canCreate,
  canEdit,
  viewerIsSuperAdmin,
  viewerBranchId,
}: {
  currency: string;
  canCreate: boolean;
  canEdit: boolean;
  viewerIsSuperAdmin: boolean;
  viewerBranchId: string | null;
}) {
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [purchases, setPurchases] = useState<PurchaseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingDraft, setEditingDraft] = useState<PurchaseDetail | null>(null);

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {
      // Filter chips just fall back to "All only" — not worth failing the whole tab over.
    });
  }, []);

  const loadPurchases = useCallback(() => {
    api
      .listPurchases(locationFilter === ALL_FILTER ? undefined : locationFilter)
      .then(setPurchases)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load purchases."));
  }, [locationFilter]);

  useEffect(loadPurchases, [loadPurchases]);

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
        {canCreate && locations && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white"
          >
            <ClipboardPlus className="size-4" aria-hidden="true" />
            New Purchase
          </button>
        )}
        {error &&<div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!purchases && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {purchases && purchases.length === 0 && <p className="py-10 text-center text-sm text-navy/50">No purchases yet.</p>}

        {purchases && purchases.length > 0 && (
          <div className="relative">
            <div
              className="pointer-events-none absolute top-2 bottom-2 left-3 border-l-2 border-dashed border-navy/20"
              aria-hidden="true"
            />
            <div className="space-y-3 pl-7">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="relative">
                  <span
                    className="pointer-events-none absolute top-9 -left-[19px] size-2 -translate-y-1/2 rounded-full border-2 border-navy/25 bg-cream-dark"
                    aria-hidden="true"
                  />
                  <PurchaseCard purchase={purchase} onSelect={() => setSelectedPurchaseId(purchase.id)} />
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
          onChanged={loadPurchases}
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
            loadPurchases();
            // Straight into the new PO — the next step (receive goods) usually follows right away.
            setSelectedPurchaseId(purchaseId);
          }}
        />
      )}
    </div>
  );
}
