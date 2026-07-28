"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CreditCard, PackageX } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { OwnerDashboard } from "@/lib/types";
import { SalesReportSection } from "../SalesReportSection";

/** Stock Alerts and Outstanding Credit are "as of right now" snapshots, not period-scoped — same
 * philosophy as DESKTOP's own Debtors/Creditors section (see DebtorsCreditorsSection.tsx: "live
 * snapshot as of today", explicitly NOT scoped to whatever period the Sales Report is showing).
 * computeStockAlerts/computeOutstandingCredit (mobile-metrics-service.ts) never actually read the
 * period range internally, so a single fixed "today" call is fetched once here, independent of the
 * Sales Report's own period selector below. */
export function DashboardTab() {
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDashboard("today")
      .then(setDashboard)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API. Check your connection."));
  }, []);

  return (
    <div className="space-y-4 px-4 py-4 pb-10">
      <SalesReportSection />

      {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
      {dashboard && (
        <>
          <StockCard dashboard={dashboard} />
          <CreditCard_ dashboard={dashboard} currency={dashboard.currency} />
        </>
      )}
    </div>
  );
}

function Card({ title, icon, accent, children }: { title: string; icon: React.ReactNode; accent: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-sm">
      <div className={`flex items-center gap-2 px-4 py-3 text-white ${accent}`}>
        {icon}
        <h2 className="text-xs font-bold tracking-wide uppercase">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StockCard({ dashboard }: { dashboard: OwnerDashboard }) {
  const { stock } = dashboard;
  const hasAlerts = stock.lowStockCount > 0 || stock.outOfStockCount > 0;
  return (
    <Card title="Stock Alerts" icon={<PackageX className="size-4" aria-hidden="true" />} accent={hasAlerts ? "bg-gold" : "bg-green"}>
      <div className="flex gap-4">
        <div>
          <p className="font-display text-xl text-navy">{stock.outOfStockCount}</p>
          <p className="text-[11px] text-navy/50 uppercase">Out of stock</p>
        </div>
        <div>
          <p className="font-display text-xl text-navy">{stock.lowStockCount}</p>
          <p className="text-[11px] text-navy/50 uppercase">Low stock</p>
        </div>
      </div>

      {!hasAlerts && <p className="mt-2 text-xs text-navy/50">All tracked products are stocked above their reorder level.</p>}

      {stock.outOfStockProducts.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-navy/10 pt-3 text-xs text-navy/70">
          {stock.outOfStockProducts.slice(0, 5).map((p) => (
            <li key={p.productId} className="flex items-center gap-1.5">
              <AlertTriangle className="size-3 text-red" aria-hidden="true" />
              {p.productName}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CreditCard_({ dashboard, currency }: { dashboard: OwnerDashboard; currency: string }) {
  const { credit } = dashboard;
  return (
    <Card
      title="Outstanding Customer Credit"
      icon={<CreditCard className="size-4" aria-hidden="true" />}
      accent={credit.customersOverLimit.length > 0 ? "bg-red" : "bg-blue"}
    >
      <p className="font-display text-2xl text-navy">{formatCents(credit.totalOutstandingCents, currency)}</p>
      <p className="text-xs text-navy/50">
        Owed by {credit.debtorCount} customer{credit.debtorCount === 1 ? "" : "s"}
      </p>

      {credit.customersOverLimit.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-navy/10 pt-3">
          <p className="text-[11px] font-bold tracking-wide text-red uppercase">Over credit limit</p>
          {credit.customersOverLimit.map((c) => (
            <div key={c.customerId} className="flex items-center justify-between text-xs">
              <span className="text-navy/70">{c.customerName}</span>
              <span className="font-semibold text-red">
                {formatCents(c.outstandingCents, currency)} / {formatCents(c.creditLimitCents, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
