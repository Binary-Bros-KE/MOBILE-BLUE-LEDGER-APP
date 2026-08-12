"use client";

import { useEffect, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { defaultAnchorForMode } from "@/lib/period";
import { taxBreakdownLabel } from "@/lib/tax";
import type {
  MobileTaxReport,
  SalesByEmployeeRow,
  SalesByStorefrontRow,
  SalesReportOverview,
  SalesReportPeriodInput,
  SalesTrendResult,
} from "@/lib/types";
import { HorizontalBarList } from "./charts/HorizontalBarList";
import { TrendAreaChart } from "./charts/TrendAreaChart";
import { SalesReportPeriodSelector } from "./SalesReportPeriodSelector";

type CardTone = "navy" | "blue" | "red" | "green";
const TONE_BG: Record<CardTone, string> = { navy: "bg-navy", blue: "bg-blue", red: "bg-red", green: "bg-green" };

/** Concentric rings bleeding off the top-right corner — ported from DESKTOP's own CardTexture
 * (FinancialOverviewCards.tsx), the "fingerprint" texture matching this project's own established
 * "colorful/textured cards, never plain white" preference. */
function CardTexture() {
  const radii = [14, 28, 42, 56, 70, 84, 98, 112];
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 200 140" preserveAspectRatio="none" aria-hidden="true">
      {radii.map((r) => (
        <circle key={r} cx={190} cy={-10} r={r} fill="none" stroke="#fffdf7" strokeWidth={1.25} opacity={0.16} />
      ))}
    </svg>
  );
}

function DeltaBadge({ percent }: { percent: number | null }) {
  if (percent === null) {
    return <span className="text-[11px] font-semibold text-white/60">No prior data to compare</span>;
  }
  const isFlat = Math.abs(percent) < 0.05;
  const isUp = percent > 0 && !isFlat;
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white/85">
      <Icon className="size-3" aria-hidden="true" />
      {percent > 0 ? "+" : ""}
      {percent.toFixed(1)}% vs previous period
    </span>
  );
}

function OverviewCard({
  tone,
  label,
  valueCents,
  currency,
  formula,
  deltaPercent,
}: {
  tone: CardTone;
  label: string;
  valueCents: number;
  currency: string;
  formula: string;
  deltaPercent: number | null;
}) {
  return (
    <div className={`relative overflow-hidden rounded-lg p-4 shadow-sm ${TONE_BG[tone]}`}>
      <CardTexture />
      <div className="relative">
        <p className="text-[11px] font-bold tracking-wide text-white/75 uppercase">{label}</p>
        <p className="mt-2 font-display text-xl text-white">{formatCents(valueCents, currency)}</p>
        <p className="mt-1.5 text-[11px] font-semibold text-white/60">{formula}</p>
        <div className="mt-2.5">
          <DeltaBadge percent={deltaPercent} />
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <p className="text-[10px] font-extrabold tracking-wide text-navy/50 uppercase">{label}</p>
      <p className="mt-1 font-display text-lg text-navy">{value}</p>
    </div>
  );
}

function BreakdownRow({
  label,
  sublabel,
  revenueCents,
  transactionCount,
  averageSaleCents,
  percentOfTotal,
  currency,
}: {
  label: string;
  sublabel?: string;
  revenueCents: number;
  transactionCount: number;
  averageSaleCents: number;
  percentOfTotal: number;
  currency: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-dashed border-navy/10 py-2 text-xs first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="truncate font-bold text-navy">{label}</p>
        {sublabel && <p className="truncate text-navy/50">{sublabel}</p>}
        <p className="text-navy/40">
          {transactionCount} txn{transactionCount === 1 ? "" : "s"} · avg {formatCents(averageSaleCents, currency)}
        </p>
      </div>
      <div className="flex-none text-right">
        <p className="font-bold text-navy">{formatCents(revenueCents, currency)}</p>
        <p className="text-navy/50">{percentOfTotal}%</p>
      </div>
    </div>
  );
}

type Breakdowns = { byStorefront: SalesByStorefrontRow[]; byEmployee: SalesByEmployeeRow[] };

/** Phone-width port of DESKTOP's Sales Report (SalesReportRoute.tsx) — Phase 1 scope: the period
 * selector, the 4 financial overview cards with period-over-period comparison, the revenue trend
 * chart, and Sales by Payment Method / Storefront / Employee breakdowns. DESKTOP's wide
 * `min-w-[600-650px]` detail tables are replaced with a bar chart + stacked card list (a literal
 * table can't fit a phone screen). All Transactions / Voids & Returns / Cancelled Purchases /
 * Debtors & Creditors / the "how we calculate this" formula panel are deliberately deferred — see
 * [[project_sales_report_mobile]] for the phasing rationale. */
export function SalesReportSection() {
  const [period, setPeriod] = useState<SalesReportPeriodInput>({ mode: "daily", anchor: defaultAnchorForMode("daily") });
  const [overview, setOverview] = useState<SalesReportOverview | null>(null);
  const [trend, setTrend] = useState<SalesTrendResult | null>(null);
  const [breakdowns, setBreakdowns] = useState<Breakdowns | null>(null);
  const [taxReport, setTaxReport] = useState<MobileTaxReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOverview(null);
    setTrend(null);
    setBreakdowns(null);
    setTaxReport(null);
    setError(null);
    Promise.all([api.getSalesReportOverview(period), api.getSalesTrend(period), api.getSalesBreakdowns(period), api.getSalesTaxBreakdown(period)])
      .then(([o, t, b, tax]) => {
        setOverview(o);
        setTrend(t);
        setBreakdowns(b);
        setTaxReport(tax);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the sales report."));
  }, [period]);

  const money = (cents: number) => formatCents(cents, overview?.currency ?? "KES");

  return (
    <div className="space-y-4">
      <SalesReportPeriodSelector value={period} onChange={setPeriod} />

      {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
      {!overview && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}

      {overview && (
        <>
          <div className="grid grid-cols-1 gap-3">
            <OverviewCard
              tone="navy"
              label="Total Revenue"
              valueCents={overview.totalRevenueCents}
              currency={overview.currency}
              formula="Sales + invoice payments received"
              deltaPercent={overview.totalRevenueChangePercent}
            />
            <OverviewCard
              tone="blue"
              label="Net Revenue"
              valueCents={overview.netRevenueCents}
              currency={overview.currency}
              formula="Margin on cash collected so far"
              deltaPercent={overview.netRevenueChangePercent}
            />
            <OverviewCard
              tone="red"
              label="Total Expenses"
              valueCents={overview.totalExpensesCents}
              currency={overview.currency}
              formula="Expenses + salaries paid — capital excluded"
              deltaPercent={overview.totalExpensesChangePercent}
            />
            <OverviewCard
              tone={overview.netProfitCents >= 0 ? "green" : "red"}
              label="Net Profit"
              valueCents={overview.netProfitCents}
              currency={overview.currency}
              formula="Net Revenue − Total Expenses"
              deltaPercent={overview.netProfitChangePercent}
            />
            <OverviewCard
              tone="blue"
              label="Total Capital Invested"
              valueCents={overview.purchasesPaidCents}
              currency={overview.currency}
              formula="Purchases (goods + shipping) paid to suppliers this period — not counted in Total Expenses"
              deltaPercent={null}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Transactions" value={String(overview.transactionCount)} />
            <StatTile label="Avg Sale" value={money(overview.averageSaleCents)} />
            <StatTile label="Items Sold" value={String(overview.itemsSold)} />
            {overview.spansMultipleDays && <StatTile label="Avg Daily Revenue" value={money(overview.averageDailyRevenueCents)} />}
          </div>

          {trend && (
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <TrendAreaChart
                title="Revenue Trend"
                points={trend.points.map((p) => ({ label: p.periodLabel, value: p.revenueCents, isSelected: p.isSelected }))}
                formatValue={money}
              />
            </div>
          )}

          {overview.paymentSplit.length > 0 && (
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="mb-3 text-[11px] font-bold tracking-wide text-navy/50 uppercase">Sales by Payment Method</p>
              <HorizontalBarList
                categorical
                items={overview.paymentSplit.map((entry) => ({ key: entry.paymentMethodName, label: entry.paymentMethodName, value: entry.revenueCents }))}
                formatValue={money}
              />
            </div>
          )}

          {breakdowns && breakdowns.byStorefront.length > 0 && (
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="mb-3 text-[11px] font-bold tracking-wide text-navy/50 uppercase">Sales by Storefront</p>
              <HorizontalBarList
                items={breakdowns.byStorefront.map((row) => ({ key: row.locationId, label: row.locationName, value: row.revenueCents }))}
                formatValue={money}
              />
              <div className="mt-3">
                {breakdowns.byStorefront.map((row) => (
                  <BreakdownRow
                    key={row.locationId}
                    label={row.locationName}
                    revenueCents={row.revenueCents}
                    transactionCount={row.transactionCount}
                    averageSaleCents={row.averageSaleCents}
                    percentOfTotal={row.percentOfTotal}
                    currency={overview.currency}
                  />
                ))}
              </div>
            </div>
          )}

          {breakdowns && breakdowns.byEmployee.length > 0 && (
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="mb-3 text-[11px] font-bold tracking-wide text-navy/50 uppercase">Sales by Employee</p>
              <HorizontalBarList
                items={breakdowns.byEmployee.map((row) => ({ key: row.employeeId, label: row.employeeName, value: row.revenueCents }))}
                formatValue={money}
              />
              <div className="mt-3">
                {breakdowns.byEmployee.map((row) => (
                  <BreakdownRow
                    key={row.employeeId}
                    label={row.employeeName}
                    sublabel={row.branchName ?? undefined}
                    revenueCents={row.revenueCents}
                    transactionCount={row.transactionCount}
                    averageSaleCents={row.averageSaleCents}
                    percentOfTotal={row.percentOfTotal}
                    currency={overview.currency}
                  />
                ))}
              </div>
            </div>
          )}

          {taxReport && taxReport.byCategory.length > 0 && (
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="mb-3 text-[11px] font-bold tracking-wide text-navy/50 uppercase">Tax Breakdown</p>
              <div className="space-y-2">
                {taxReport.byCategory.map((entry) => (
                  <div key={entry.taxType} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-bold text-navy">{taxBreakdownLabel(entry.taxType, taxReport.vatRatePercent)}</span>
                    <span className="text-navy/70">
                      Net {money(entry.netCents)} / Tax {money(entry.taxCents)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 border-t border-navy/10 pt-2 text-sm font-extrabold text-navy">
                  <span>Total</span>
                  <span>{money(taxReport.totalGrossCents)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
