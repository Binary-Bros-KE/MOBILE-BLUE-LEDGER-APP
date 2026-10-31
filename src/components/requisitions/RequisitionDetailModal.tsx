"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Link2, Loader2, Pencil, Plus, Search, ShoppingBag, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MobileCategory, MobileLocation, ProductListItem, RequisitionDetail, RequisitionItem } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { ProductFormModal } from "../products/ProductFormModal";
import type { ProductManageOptions } from "../products/manage-options";
import { NewPurchaseModal, type PurchaseFromRequisition } from "../purchases/NewPurchaseModal";
import { RequisitionStatusPill, formatDate } from "./requisition-ui";

/**
 * One requisition: what was asked for, and — for an approver while it's pending — the review:
 * link each new (free-text) item to a catalog product or create it, then Approve (opens the purchase
 * sheet pre-filled, saving it approves the requisition), or Reject with a reason. The requester can
 * cancel their own pending requisition. Once approved it shows the purchase it became and that
 * purchase's progress (ordered → received).
 */
export function RequisitionDetailModal({
  requisitionId,
  currency,
  viewerEmployeeId,
  viewerIsSuperAdmin,
  viewerBranchId,
  vatRatePercent,
  canApprove,
  canCreatePurchase,
  canCreateProduct,
  onClose,
  onChanged,
  onOpenPurchases,
  onEdit,
}: {
  requisitionId: string;
  currency: string;
  viewerEmployeeId: string | null;
  viewerIsSuperAdmin: boolean;
  viewerBranchId: string | null;
  vatRatePercent: number;
  canApprove: boolean;
  canCreatePurchase: boolean;
  canCreateProduct: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenPurchases: () => void;
  /** Re-open this pending requisition in the New Requisition sheet (requester or Super Admin). */
  onEdit: (requisition: RequisitionDetail) => void;
}) {
  const [detail, setDetail] = useState<RequisitionDetail | null>(null);
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approving, setApproving] = useState<PurchaseFromRequisition | null>(null);
  const [creatingFor, setCreatingFor] = useState<RequisitionItem | null>(null);
  const [productOptions, setProductOptions] = useState<ProductManageOptions | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getRequisition(requisitionId)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this requisition."));
  }, [requisitionId]);

  useEffect(load, [load]);

  const reviewing = canApprove && detail?.status === "pending";

  // Only an approver reviewing needs the catalog (linking) and locations (the purchase sheet).
  useEffect(() => {
    if (!reviewing) return;
    api.listProducts().then(setProducts).catch(() => setProducts([]));
    api.listLocations().then(setLocations).catch(() => setLocations([]));
  }, [reviewing]);

  const linkMatches = useMemo(() => {
    const term = linkSearch.trim().toLowerCase();
    if (!products || !term) return [];
    return products.filter((p) => `${p.name} ${p.sku} ${p.barcode ?? ""}`.toLowerCase().includes(term)).slice(0, 8);
  }, [products, linkSearch]);

  async function run(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function link(itemId: string, productId: string): Promise<void> {
    const ok = await run(async () => setDetail(await api.linkRequisitionItem(requisitionId, itemId, productId)), "Failed to link the product.");
    if (ok) {
      setLinkingItemId(null);
      setLinkSearch("");
      onChanged();
    }
  }

  async function startCreateProduct(item: RequisitionItem): Promise<void> {
    if (!productOptions) {
      const ok = await run(async () => {
        const [categories, allLocations] = await Promise.all([api.listCategories(), api.listLocations()]);
        setProductOptions({
          categories,
          locations: allLocations,
          branchScope: viewerIsSuperAdmin ? null : viewerBranchId,
          workingLocationId: viewerBranchId,
          vatRatePercent,
        });
      }, "Could not open the product form.");
      if (!ok) return;
    }
    setCreatingFor(item);
  }

  async function cancel(): Promise<void> {
    if (!detail || !window.confirm(`Cancel ${detail.requisitionNumber}? It can no longer be approved.`)) return;
    if (await run(() => api.cancelRequisition(requisitionId), "Failed to cancel.")) {
      onChanged();
      load();
    }
  }

  async function reject(): Promise<void> {
    if (!rejectReason.trim()) return setError("Give a reason for rejecting.");
    if (await run(() => api.rejectRequisition(requisitionId, rejectReason.trim()), "Failed to reject.")) {
      setRejecting(false);
      onChanged();
      load();
    }
  }

  function startApprove(): void {
    if (!detail || !locations || !products) return;
    const location = locations.find((l) => l.id === detail.storefrontId);
    if (!location) return setError("This requisition's storefront isn't available to you.");
    const byId = new Map(products.map((p) => [p.id, p]));
    const items: PurchaseFromRequisition["items"] = [];
    for (const item of detail.items) {
      const product = item.productId ? byId.get(item.productId) : undefined;
      if (!item.productId) return setError(`Link "${item.itemName}" to a product first.`);
      items.push({
        productId: item.productId,
        name: product?.name ?? item.productName ?? item.itemName,
        sku: product?.sku ?? item.sku ?? "",
        taxType: product?.taxType ?? item.taxType ?? "vat",
        sellingPriceCents: product?.sellingPriceCents ?? item.sellingPriceCents,
        quantity: item.quantityRequested,
      });
    }
    setApproving({ requisitionId: detail.id, requisitionNumber: detail.requisitionNumber, location, items });
  }

  // Client rule: a requisition belongs to whoever raised it — only they (or a Super Admin) edit or
  // withdraw it; approvers act through Approve / Reject. SERVER enforces the same.
  const canModify = detail?.status === "pending" && (detail.requestedBy === viewerEmployeeId || viewerIsSuperAdmin);

  return (
    <>
      <BottomSheet
        title={detail?.requisitionNumber ?? "Requisition"}
        subtitle={detail ? `${detail.storefrontName} · ${detail.requestedByName} · ${formatDate(detail.requestedAt)}` : undefined}
        onClose={onClose}
      >
        {!detail ? (
          error ? (
            <SheetError message={error} />
          ) : (
            <p className="py-10 text-center text-sm text-navy/50">Loading…</p>
          )
        ) : (
          <div className="space-y-3">
            <SheetError message={error} />
            {notice && <p className="rounded border border-green/30 bg-green/10 px-3 py-2 text-xs font-semibold text-green">{notice}</p>}

            <div className="flex flex-wrap items-center gap-1.5">
              <RequisitionStatusPill status={detail.status} />
              {detail.reviewedByName && (
                <span className="text-[11px] text-navy/50">
                  {detail.status === "cancelled" ? "Cancelled" : "Reviewed"} by {detail.reviewedByName}
                  {detail.reviewedAt ? ` · ${formatDate(detail.reviewedAt)}` : ""}
                </span>
              )}
            </div>

            {detail.purchaseNumber && (
              <button
                type="button"
                onClick={onOpenPurchases}
                className="flex w-full items-center gap-2 rounded-lg border border-blue/30 bg-blue/5 px-3 py-2 text-left text-xs font-bold text-blue"
              >
                <ShoppingBag className="size-4 flex-none" aria-hidden="true" />
                Purchase {detail.purchaseNumber} · {(detail.purchaseStatus ?? "").replace(/_/g, " ")}
              </button>
            )}
            {detail.notes && <p className="rounded-lg bg-cream-dark/60 px-3 py-2 text-xs text-navy">{detail.notes}</p>}
            {detail.rejectionReason && (
              <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">Rejected: {detail.rejectionReason}</p>
            )}

            {detail.items.map((item) => (
              <div key={item.id} className="rounded-lg border border-navy/15 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy">{item.itemName}</p>
                    {item.notes && <p className="text-[11px] text-navy/50">{item.notes}</p>}
                    {item.productId ? (
                      item.productName && item.productName !== item.itemName ? (
                        <p className="text-[11px] text-navy/50">
                          → {item.productName} · {item.sku}
                        </p>
                      ) : (
                        <p className="text-[11px] text-navy/40">{item.sku}</p>
                      )
                    ) : (
                      <p className="text-[11px] font-bold text-blue">New item — not in catalog</p>
                    )}
                  </div>
                  <p className="flex-none font-display text-sm text-navy">×{item.quantityRequested}</p>
                </div>

                {reviewing && (
                  <div className="mt-2">
                    {linkingItemId === item.id ? (
                      <div>
                        <div className="relative">
                          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
                          <input
                            autoFocus
                            value={linkSearch}
                            onChange={(e) => setLinkSearch(e.target.value)}
                            placeholder="Find the product…"
                            className={`${sheetInputClass} mt-0 pl-9`}
                          />
                        </div>
                        {linkMatches.length > 0 && (
                          <div className="mt-1 divide-y divide-navy/10 rounded-lg border border-navy/15">
                            {linkMatches.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                disabled={busy}
                                onClick={() => void link(item.id, p.id)}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-cream-dark"
                              >
                                <span className="truncate font-bold text-navy">{p.name}</span>
                                <span className="flex-none text-navy/40">{p.sku}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setLinkingItemId(item.id);
                            setLinkSearch(item.productId ? "" : item.itemName);
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-blue"
                        >
                          <Link2 className="size-3.5" aria-hidden="true" />
                          {item.productId ? "Change product" : "Link to a product"}
                        </button>
                        {!item.productId && canCreateProduct && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void startCreateProduct(item)}
                            className="flex items-center gap-1 text-[11px] font-bold text-blue"
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                            Create as new product
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {reviewing && rejecting && (
              <div className="space-y-2 rounded-lg border border-red/30 p-3">
                <SheetField label="Reason for rejecting">
                  <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} className={sheetInputClass} />
                </SheetField>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRejecting(false)} className="rounded-lg border border-navy/20 py-2.5 text-sm font-bold text-navy">
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void reject()}
                    className="flex items-center justify-center gap-2 rounded-lg bg-red py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                    Reject
                  </button>
                </div>
              </div>
            )}

            {reviewing && !rejecting && (
              <div className="space-y-2 border-t border-dashed border-navy/15 pt-3">
                {detail.unlinkedItemCount > 0 && (
                  <p className="text-center text-[11px] font-semibold text-navy/50">
                    Link {detail.unlinkedItemCount} new item{detail.unlinkedItemCount === 1 ? "" : "s"} to approve
                  </p>
                )}
                {!canCreatePurchase && (
                  <p className="text-center text-[11px] font-semibold text-navy/50">Approving also needs permission to create purchases.</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRejectReason("");
                      setRejecting(true);
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-red/40 py-3 text-sm font-bold text-red disabled:opacity-50"
                  >
                    <XCircle className="size-4" aria-hidden="true" />
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busy || detail.unlinkedItemCount > 0 || !canCreatePurchase || !products || !locations}
                    onClick={startApprove}
                    className="flex items-center justify-center gap-2 rounded-lg bg-green py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Approve
                  </button>
                </div>
              </div>
            )}

            {canModify && !rejecting && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onEdit(detail)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-navy/20 py-2.5 text-sm font-bold text-navy disabled:opacity-50"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cancel()}
                  className="flex items-center justify-center gap-2 rounded-lg border border-navy/20 py-2.5 text-sm font-bold text-navy/70 disabled:opacity-50"
                >
                  <Ban className="size-4" aria-hidden="true" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {approving && (
        <NewPurchaseModal
          locations={[approving.location]}
          currency={currency}
          fromRequisition={approving}
          onClose={() => setApproving(null)}
          onCreated={() => {
            setApproving(null);
            setNotice("Approved — the purchase is ready. Receive the goods from Purchases when they arrive.");
            onChanged();
            load();
          }}
        />
      )}

      {creatingFor && productOptions && (
        <ProductFormModal
          productId={null}
          options={productOptions}
          initialName={creatingFor.itemName}
          onClose={() => setCreatingFor(null)}
          onCategoryCreated={(category: MobileCategory) =>
            setProductOptions((prev) => (prev ? { ...prev, categories: [...prev.categories, category] } : prev))
          }
          onSaved={(createdId) => {
            const item = creatingFor;
            setCreatingFor(null);
            if (!createdId) return;
            // Refresh the catalog so the purchase sheet knows the new product, then link it.
            api.listProducts().then(setProducts).catch(() => undefined);
            void link(item.id, createdId);
          }}
        />
      )}
    </>
  );
}
