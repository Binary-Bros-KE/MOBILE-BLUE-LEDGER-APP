"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { centsForCsv, exportCsv } from "@/lib/csv-export";
import { formatCents } from "@/lib/money";
import { defaultAnchorForMode } from "@/lib/period";
import { taxBreakdownLabel } from "@/lib/tax";
import type {
  MobileTaxReport,
  SalesByEmployeeRow,
  SalesByStorefrontRow,
  SalesProductSold,
  SalesReportOverview,
  SalesReportPeriodInput,
  SalesTrendResult,
} from "@/lib/types";
import { HorizontalBarList } from "./charts/HorizontalBarList";
import { OverviewCard } from "./OverviewCard";
import { formatQuantityWithUnit } from "./products/manage-options";
import { TrendAreaChart } from "./charts/TrendAreaChart";
import { SalesReportPeriodSelector } from "./SalesReportPeriodSelector";

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

const PRODUCTS_SOLD_PREVIEW = 10;

const percent = (value: number) => `${value.toFixed(1)}%`;

/** DESKTOP's "Products Sold" table as a stacked list: every distinct product sold in the period,
 * most revenue first — units and share of revenue on the left, revenue and margin on the right. */
function ProductsSoldCard({ products, currency, startDate, endDate }: { products: SalesProductSold[]; currency: string; startDate: string; endDate: string }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? products : products.slice(0, PRODUCTS_SOLD_PREVIEW);

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold tracking-wide text-navy/50 uppercase">Products Sold ({products.length})</p>
        <button
          type="button"
          aria-label="Export products sold as CSV"
          onClick={() =>
            void exportCsv(
              `products-sold-${startDate}-to-${endDate}.csv`,
              ["Product", "Quantity Sold", "Unit", "Revenue", "Cost", "Margin", "Margin %", "% of Revenue"],
              products.map((p) => [
                p.productName,
                p.quantitySold,
                p.unitOfMeasure ?? "",
                centsForCsv(p.revenueCents),
                centsForCsv(p.costCents),
                centsForCsv(p.marginCents),
                p.marginPercent.toFixed(1),
                p.percentOfRevenue.toFixed(1),
              ]),
            )
          }
          className="flex flex-none items-center gap-1 rounded-md border border-navy/15 px-2 py-1 text-[11px] font-bold text-navy/70"
        >
          <Download className="size-3.5" aria-hidden="true" />
          CSV
        </button>
      </div>

      {visible.map((p, index) => (
        <div key={p.productId} className="flex items-center justify-between gap-3 border-t border-dashed border-navy/10 py-2 text-xs first:border-t-0 first:pt-0">
          <div className="flex min-w-0 items-start gap-2">
            <span className="w-5 flex-none pt-px text-right font-bold text-navy/30">{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate font-bold text-navy">{p.productName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="rounded-full bg-blue/50 px-2.5 py-0.5 text-xs font-extrabold text-white">
                  {formatQuantityWithUnit(p.quantitySold, p.unitOfMeasure)}
                </span>
                <span className="text-navy/50">{percent(p.percentOfRevenue)} of revenue</span>
              </div>
            </div>
          </div>
          <div className="flex-none text-right">
            <p className="font-bold text-navy">{formatCents(p.revenueCents, currency)}</p>
            <p className={p.marginCents < 0 ? "text-red" : "text-green"}>
              {formatCents(p.marginCents, currency)} · {percent(p.marginPercent)}
            </p>
          </div>
        </div>
      ))}

      {products.length > PRODUCTS_SOLD_PREVIEW && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 w-full rounded-md py-2 text-xs font-bold text-blue">
          {showAll ? "Show less" : `Show all ${products.length} products`}
        </button>
      )}
      <p className="mt-2 text-[10px] text-navy/40">Net of returns. Margin uses each product&apos;s current buying price.</p>
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
export function SalesReportSection({ locationId }: { locationId?: string }) {
  const [period, setPeriod] = useState<SalesReportPeriodInput>({ mode: "daily", anchor: defaultAnchorForMode("daily") });
  /** Everything one request returned, tagged with the period/location it was for — figures from an
   * older request are never shown under a newer selection (it reads as Loading until they arrive). */
  const [loaded, setLoaded] = useState<{
    key: string;
    overview: SalesReportOverview | null;
    trend: SalesTrendResult | null;
    breakdowns: Breakdowns | null;
    taxReport: MobileTaxReport | null;
    error: string | null;
  } | null>(null);
  const requestKey = JSON.stringify([period, locationId ?? null]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getSalesReportOverview(period, locationId),
      api.getSalesTrend(period, locationId),
      api.getSalesBreakdowns(period, locationId),
      api.getSalesTaxBreakdown(period, locationId),
    ])
      .then(([o, t, b, tax]) => {
        if (!cancelled) setLoaded({ key: requestKey, overview: o, trend: t, breakdowns: b, taxReport: tax, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoaded({
            key: requestKey,
            overview: null,
            trend: null,
            breakdowns: null,
            taxReport: null,
            error: err instanceof ApiError ? err.message : "Could not load the sales report.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // requestKey is derived from period + locationId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, locationId]);

  const current = loaded?.key === requestKey ? loaded : null;
  const overview = current?.overview ?? null;
  const trend = current?.trend ?? null;
  const breakdowns = current?.breakdowns ?? null;
  const taxReport = current?.taxReport ?? null;
  const error = current?.error ?? null;

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

          {overview.productsSold.length > 0 && (
            <ProductsSoldCard
              key={requestKey}
              products={overview.productsSold}
              currency={overview.currency}
              startDate={overview.startDate}
              endDate={overview.endDate}
            />
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
                  <div key={`${entry.taxType}:${entry.pricingMode ?? ""}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-bold text-navy">
                      {taxBreakdownLabel(entry.taxType, taxReport.vatRatePercent, entry.pricingMode)}
                    </span>
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
