"use client";

import { useEffect, useState } from "react";
import { CreditCard, Receipt, Store } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { OwnerDashboard } from "@/lib/types";
import { OverviewCard } from "../OverviewCard";
import type { TabKey } from "../nav/navigation";

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** The Cashier's own dashboard variant — ports DESKTOP's CashierDashboard.tsx: personal performance
 * first (the same colorful/textured OverviewCard this app already uses everywhere else — the earlier
 * version of this file used plain white boxes, a real regression against this project's own
 * established visual language), a real activity feed of today's individual sales (not just a
 * number — see mySales/myRecentSales on the dashboard response, mobile-metrics-service.ts), the
 * shop's own pulse second and smaller (matching DESKTOP's own framing), and a New Sale shortcut. No
 * trend/week-over-week, no team ranking, no Held Sales widget — mobile Checkout has no hold/suspend
 * concept at all, unlike DESKTOP's.
 *
 * Only the hero card and the bottom shop-wide card carry money — per explicit client correction, a
 * cashier should never see the shop's (or even their own) total revenue, so those two specifically
 * became "Number of Sales" and "Waiting Approval" (see pendingApprovalsToday's own doc comment,
 * mobile-metrics-service.ts, for why that count is safe to show — no money in it). The middle
 * Transactions/Average-Sale pair and the per-sale activity feed below are untouched — the client only
 * flagged those two specific cards, not this whole layout. */
export function CashierDashboardTab({ branchId, branchName, onNavigate }: { branchId: string | null; branchName: string | null; onNavigate: (tab: TabKey) => void }) {
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDashboard("today", branchId ?? undefined)
      .then(setDashboard)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API. Check your connection."));
  }, [branchId]);

  const mySales = dashboard?.mySales ?? null;
  const myRecentSales = dashboard?.myRecentSales ?? [];
  const averageSaleCents = mySales && mySales.transactionCount > 0 ? Math.round(mySales.revenueCents / mySales.transactionCount) : 0;
  const currency = dashboard?.currency ?? "KES";

  return (
    <div className="space-y-4 px-4 py-4 pb-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-navy/50">Your performance today</p>
        {branchName && (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-blue">
            <Store className="size-3" aria-hidden="true" />
            {branchName}
          </span>
        )}
      </div>

      {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}

      {dashboard && (
        <>
          <div className="grid grid-cols-1 gap-3">
            <OverviewCard tone="navy" label="Number of Sales" displayValue={String(mySales?.transactionCount ?? 0)} formula="Sales you've completed" footnote="So far today" />
            <div className="grid grid-cols-2 gap-3">
              <OverviewCard tone="blue" label="My Transactions" displayValue={String(mySales?.transactionCount ?? 0)} formula="Sales completed" footnote="So far today" />
              <OverviewCard tone="gold" label="My Average Sale" valueCents={averageSaleCents} currency={currency} formula="Per transaction" footnote="So far today" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("checkout")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white shadow-sm"
          >
            <CreditCard className="size-4" aria-hidden="true" />
            New Sale
          </button>

          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-navy/10 px-4 py-3">
              <Receipt className="size-4 text-blue" aria-hidden="true" />
              <h3 className="text-sm font-extrabold text-navy">My sales today</h3>
            </div>
            {myRecentSales.length === 0 ? (
              <p className="p-4 text-sm text-navy/50">You haven&apos;t completed any sales yet today.</p>
            ) : (
              <div className="divide-y divide-navy/10">
                {myRecentSales.map((sale) => (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => onNavigate("sales")}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-navy">{sale.documentNumber ?? "No receipt #"}</p>
                      <p className="text-[11px] text-navy/50">{time(sale.occurredAt)}</p>
                    </div>
                    <p className="flex-none font-display text-sm text-navy">{formatCents(sale.amountCents, currency)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-navy/15 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-navy/50">
              {branchName ? `${branchName} today` : "Storefront today"}
            </p>
            <div className="mt-2">
              <p className="font-display text-lg text-navy">{dashboard.pendingApprovalsToday}</p>
              <p className="text-[11px] text-navy/50">Sales waiting on manager approval</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
