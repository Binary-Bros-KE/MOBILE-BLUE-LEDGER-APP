"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, PackageX, Store, Truck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { OwnerDashboard, PurchaseListItem, StockMovementRow as StockMovementRowType } from "@/lib/types";
import { OverviewCard } from "../OverviewCard";
import { StockMovementRow } from "../StockMovementRow";
import type { TabKey } from "../nav/navigation";

const OUTSTANDING_STATUSES = new Set(["ordered", "partially_received"]);

/** The Storekeeper's own dashboard variant — a scoped-down port of DESKTOP's
 * StorekeeperDashboard.tsx, using this app's own colorful/textured OverviewCard (the earlier version
 * of this file used plain dashed boxes — a real regression against this project's own established
 * visual language, same fix as CashierDashboardTab's). Three widgets reuse data mobile already
 * exposes elsewhere (no new SERVER work needed for any of them): OwnerDashboard.stock (already
 * powers the Admin dashboard's own Stock Alerts card), the same api.listStockMovements(locationId)
 * StockLedgerTab.tsx already calls, and api.listPurchases(locationId) summed client-side for an
 * "outstanding purchases" figure. DESKTOP's own "products needing reallocation" table is
 * deliberately NOT ported — it's powered by Main Store allocation data that's explicitly local-only/
 * unrecoverable server-side (see project_owner_app_feature memory) and mobile has no Main Store tab
 * at all to link it to. */
export function StorekeeperDashboardTab({ branchId, branchName, onNavigate }: { branchId: string | null; branchName: string | null; onNavigate: (tab: TabKey) => void }) {
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [movements, setMovements] = useState<StockMovementRowType[] | null>(null);
  const [purchases, setPurchases] = useState<PurchaseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getDashboard("today", branchId ?? undefined),
      api.listStockMovements(branchId ?? undefined),
      api.listPurchases(branchId ?? undefined),
    ])
      .then(([dashboardResult, movementsResult, purchasesResult]) => {
        setDashboard(dashboardResult);
        setMovements(movementsResult);
        setPurchases(purchasesResult);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API. Check your connection."));
  }, [branchId]);

  const outstanding = useMemo(() => {
    const rows = (purchases ?? []).filter((p) => OUTSTANDING_STATUSES.has(p.status));
    const totalOwedCents = rows.reduce((sum, p) => sum + (p.grandTotalCents - p.amountPaidCents), 0);
    return { count: rows.length, totalOwedCents, currency: rows[0]?.currency ?? dashboard?.currency ?? "KES" };
  }, [purchases, dashboard]);

  const stock = dashboard?.stock ?? null;

  return (
    <div className="space-y-4 px-4 py-4 pb-10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-navy/50">Stock health</p>
        {branchName && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-blue">
            <Store className="size-3" aria-hidden="true" />
            {branchName}
          </span>
        )}
      </div>

      {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}

      {stock && (
        <div className="grid grid-cols-2 gap-3">
          <OverviewCard tone="gold" label="Low Stock" displayValue={String(stock.lowStockCount)} formula="Below reorder level" footnote={branchName ?? "At this storefront"} />
          <OverviewCard tone="red" label="Out of Stock" displayValue={String(stock.outOfStockCount)} formula="At zero right now" footnote={branchName ?? "At this storefront"} />
        </div>
      )}

      {stock && stock.outOfStockProducts.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-wide text-navy/70">Out of stock</p>
          <ul className="mt-2 space-y-1.5 text-xs text-navy/70">
            {stock.outOfStockProducts.slice(0, 6).map((p) => (
              <li key={p.productId} className="flex items-center gap-1.5">
                <AlertTriangle className="size-3 flex-none text-red" aria-hidden="true" />
                <span className="truncate">{p.productName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => onNavigate("purchases")}
        className="flex w-full items-center justify-between gap-2 rounded-lg bg-navy p-4 text-left shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Truck className="size-4 flex-none text-white/70" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-white">Outstanding Purchases</p>
            <p className="text-xs text-white/60">{outstanding.count} order{outstanding.count === 1 ? "" : "s"} still owed</p>
          </div>
        </div>
        <p className="font-display text-sm text-white">{formatCents(outstanding.totalOwedCents, outstanding.currency)}</p>
      </button>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-extrabold uppercase tracking-wide text-navy/70">Recent stock movements</p>
          <button type="button" onClick={() => onNavigate("stockLedger")} className="text-[11px] font-bold text-blue">
            View all
          </button>
        </div>
        {movements && movements.length === 0 && (
          <p className="rounded-lg bg-white p-4 text-center text-sm text-navy/50 shadow-sm">
            <PackageX className="mx-auto mb-1 size-5 text-navy/30" aria-hidden="true" />
            No stock movements recorded yet.
          </p>
        )}
        <div className="space-y-2">
          {(movements ?? []).slice(0, 8).map((movement) => (
            <StockMovementRow key={movement.id} movement={movement} />
          ))}
        </div>
      </div>
    </div>
  );
}
