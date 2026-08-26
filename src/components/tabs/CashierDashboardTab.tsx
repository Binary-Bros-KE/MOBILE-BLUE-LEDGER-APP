"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { OwnerDashboard } from "@/lib/types";
import type { TabKey } from "../nav/navigation";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <p className="text-[10px] font-extrabold tracking-wide text-navy/50 uppercase">{label}</p>
      <p className="mt-1 font-display text-lg text-navy">{value}</p>
    </div>
  );
}

/** The Cashier's own dashboard variant — ports DESKTOP's CashierDashboard.tsx: personal performance
 * first, no trend/week-over-week, no team ranking ("cashiers report having hated a visible rank" —
 * same doc comment DESKTOP's own version carries). Sourced from OwnerDashboard.mySales, an
 * employee-scoped SalesSnapshot the /mobile/dashboard endpoint now also computes alongside the
 * normal business-wide one (see getOwnerDashboard's own employeeId parameter). No Held Sales widget
 * — mobile Checkout has no hold/suspend concept at all, unlike DESKTOP's. */
export function CashierDashboardTab({ branchId, onNavigate }: { branchId: string | null; onNavigate: (tab: TabKey) => void }) {
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDashboard("today", branchId ?? undefined)
      .then(setDashboard)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API. Check your connection."));
  }, [branchId]);

  const mySales = dashboard?.mySales ?? null;
  const averageSaleCents = mySales && mySales.transactionCount > 0 ? Math.round(mySales.revenueCents / mySales.transactionCount) : 0;
  const currency = dashboard?.currency ?? "KES";

  return (
    <div className="space-y-4 px-4 py-4 pb-10">
      <p className="text-xs font-bold uppercase tracking-wide text-navy/50">Your performance today</p>

      {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}

      {mySales && (
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="My Sales" value={formatCents(mySales.revenueCents, currency)} />
          <StatTile label="My Transactions" value={String(mySales.transactionCount)} />
          <StatTile label="My Average Sale" value={formatCents(averageSaleCents, currency)} />
        </div>
      )}

      <button
        type="button"
        onClick={() => onNavigate("checkout")}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white"
      >
        <CreditCard className="size-4" aria-hidden="true" />
        New Sale
      </button>
    </div>
  );
}
