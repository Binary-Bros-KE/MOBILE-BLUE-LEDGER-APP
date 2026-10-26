"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Snail, TrendingUp, Warehouse } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { centsForCsv, exportCsv } from "@/lib/csv-export";
import { formatCents } from "@/lib/money";
import { timezoneOffsetMinutes } from "@/lib/period";
import type { MobileLocation, ProductPerformanceReport, StockValueReport } from "@/lib/types";
import { FilterChip } from "../FilterChip";

type View = "stock" | "products";
type Preset = "today" | "7d" | "30d" | "month";
type SortKey = "quantitySold" | "revenueCents" | "profitCents";

const ALL = "__all__";

function localDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function rangeFor(preset: Preset): { startDate: string; endDate: string } {
  const endDate = localDate();
  if (preset === "today") return { startDate: endDate, endDate };
  if (preset === "7d") return { startDate: localDate(-6), endDate };
  if (preset === "30d") return { startDate: localDate(-29), endDate };
  return { startDate: `${endDate.slice(0, 8)}01`, endDate };
}

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
];

/**
 * Stock Value (what's sitting on the shelves, at cost and at selling price, per location) and
 * Products (best sellers by units/revenue/profit, and slow movers) — the two DESKTOP reports the
 * Dashboard's Sales Report doesn't cover, with the same definitions (see SERVER's
 * mobile-reports-service.ts). reports.view; a branch-scoped employee only sees their own storefront.
 * Both export to CSV through the share sheet.
 */
export function ReportsTab({ viewerIsSuperAdmin }: { viewerIsSuperAdmin: boolean }) {
  const [view, setView] = useState<View>("stock");
  const [preset, setPreset] = useState<Preset>("30d");
  const [sortKey, setSortKey] = useState<SortKey>("quantitySold");
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [locationId, setLocationId] = useState(ALL);
  const [stock, setStock] = useState<StockValueReport | null>(null);
  const [performance, setPerformance] = useState<ProductPerformanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!viewerIsSuperAdmin) return;
    api
      .listLocations()
      .then(setLocations)
      .catch(() => {
        // "All locations" only.
      });
  }, [viewerIsSuperAdmin]);

  const location = locationId === ALL ? undefined : locationId;

  useEffect(() => {
    if (view !== "stock") return;
    let cancelled = false;
    api
      .getStockValueReport(location)
      .then((r) => {
        if (!cancelled) setStock(r);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load the report.");
      });
    return () => {
      cancelled = true;
    };
  }, [view, location]);

  useEffect(() => {
    if (view !== "products") return;
    let cancelled = false;
    api
      .getProductPerformanceReport({ ...rangeFor(preset), timezoneOffsetMinutes: timezoneOffsetMinutes(), locationId: location })
      .then((r) => {
        if (!cancelled) setPerformance(r);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load the report.");
      });
    return () => {
      cancelled = true;
    };
  }, [view, preset, location]);

  const sortedBest = useMemo(() => [...(performance?.bestSelling ?? [])].sort((a, b) => b[sortKey] - a[sortKey]), [performance, sortKey]);

  function switchView(next: View): void {
    setError(null);
    setView(next);
  }

  return (
    <div className="space-y-4 px-4 py-4 pb-10">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-white p-1 shadow-sm">
        {(
          [
            ["stock", "Stock Value", Warehouse],
            ["products", "Products", TrendingUp],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchView(key)}
            className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold ${view === key ? "bg-navy text-white" : "text-navy/50"}`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {locations && locations.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip label="All locations" active={locationId === ALL} onClick={() => setLocationId(ALL)} />
          {locations.map((l) => (
            <FilterChip key={l.id} label={l.locationName} active={locationId === l.id} onClick={() => setLocationId(l.id)} />
          ))}
        </div>
      )}

      {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}

      {view === "stock" && !stock && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
      {view === "stock" && stock && (
        <>
          <section className="grid grid-cols-2 gap-2">
            <Tile label="Stock at cost" value={formatCents(stock.costValueCents, stock.currency)} />
            <Tile label="At selling price" value={formatCents(stock.retailValueCents, stock.currency)} />
            <Tile label="Units on hand" value={stock.totalUnits.toLocaleString()} />
            <Tile label="Potential margin" value={formatCents(stock.retailValueCents - stock.costValueCents, stock.currency)} />
          </section>

          <section className="rounded-lg bg-white p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-extrabold tracking-wide text-navy/50 uppercase">By location</p>
            <div className="divide-y divide-navy/10">
              {stock.locations.map((l) => (
                <div key={l.locationId} className="py-2">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-bold text-navy">{l.locationName}</span>
                    <span className="font-bold text-navy">{formatCents(l.costValueCents, stock.currency)}</span>
                  </div>
                  <p className="text-[11px] text-navy/50">
                    {l.totalUnits.toLocaleString()} units · {l.productCount} products
                    {l.lowStockCount > 0 ? ` · ${l.lowStockCount} low` : ""}
                    {l.outOfStockCount > 0 ? ` · ${l.outOfStockCount} out` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-white p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-extrabold tracking-wide text-navy/50 uppercase">Where the money is sitting</p>
            <div className="space-y-1.5">
              {stock.topProducts.map((p) => (
                <div key={p.productId} className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-navy/70">
                    {p.name} <span className="text-xs text-navy/40">×{p.units}</span>
                  </span>
                  <span className="flex-none font-semibold text-navy">{formatCents(p.costValueCents, stock.currency)}</span>
                </div>
              ))}
            </div>
          </section>

          <ExportButton
            onClick={() =>
              void exportCsv(
                `stock-value-${localDate()}.csv`,
                ["Location", "Units", "Products", "Value at cost", "Value at selling price", "Low stock", "Out of stock"],
                stock.locations.map((l) => [l.locationName, l.totalUnits, l.productCount, centsForCsv(l.costValueCents), centsForCsv(l.retailValueCents), l.lowStockCount, l.outOfStockCount]),
              )
            }
          />
        </>
      )}

      {view === "products" && (
        <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PRESETS.map((p) => (
            <FilterChip key={p.key} label={p.label} active={preset === p.key} onClick={() => setPreset(p.key)} />
          ))}
        </div>
      )}
      {view === "products" && !performance && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
      {view === "products" && performance && (
        <>
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold tracking-wide text-navy/50 uppercase">Best sellers</p>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-md border border-navy/15 bg-white px-2 py-1 text-[11px] font-bold text-navy"
                aria-label="Sort best sellers"
              >
                <option value="quantitySold">By units</option>
                <option value="revenueCents">By revenue</option>
                <option value="profitCents">By profit</option>
              </select>
            </div>
            {sortedBest.length === 0 && <p className="py-4 text-center text-xs text-navy/50">No sales in this period.</p>}
            <div className="divide-y divide-navy/10">
              {sortedBest.slice(0, 30).map((p, i) => (
                <div key={p.productId} className="flex items-center gap-2 py-2">
                  <span className="w-5 flex-none text-xs font-bold text-navy/30">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-navy">{p.name}</p>
                    <p className="text-[11px] text-navy/50">
                      {p.quantitySold} sold · {formatCents(p.revenueCents, performance.currency)}
                    </p>
                  </div>
                  <span className={`flex-none text-xs font-bold ${p.profitCents >= 0 ? "text-green" : "text-red"}`}>{formatCents(p.profitCents, performance.currency)}</span>
                </div>
              ))}
            </div>
            {sortedBest.length > 0 && <p className="mt-2 text-[10px] text-navy/40">Profit uses each product&apos;s current buying price.</p>}
          </section>

          <section className="rounded-lg bg-white p-4 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-navy/50 uppercase">
              <Snail className="size-3.5" aria-hidden="true" />
              Slow movers
            </p>
            <div className="divide-y divide-navy/10">
              {performance.slowMoving.map((p) => (
                <div key={p.productId} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate text-sm text-navy/70">{p.name}</span>
                  <span className="flex-none text-[11px] text-navy/50">
                    {p.quantitySoldInPeriod} sold ·{" "}
                    {p.daysSinceLastSale === null ? `none in ${performance.lookbackDays}+ days` : p.daysSinceLastSale === 0 ? "sold today" : `last ${p.daysSinceLastSale}d ago`}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <ExportButton
            onClick={() =>
              void exportCsv(
                `products-${performance.startDate}-to-${performance.endDate}.csv`,
                ["Product", "SKU", "Units sold", "Revenue", "Cost", "Profit"],
                sortedBest.map((p) => [p.name, p.sku, p.quantitySold, centsForCsv(p.revenueCents), centsForCsv(p.costCents), centsForCsv(p.profitCents)]),
              )
            }
          />
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <p className="text-[10px] font-bold tracking-wide text-navy/50 uppercase">{label}</p>
      <p className="mt-0.5 font-display text-base text-navy">{value}</p>
    </div>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-lg border border-navy/20 bg-white py-3 text-sm font-bold text-navy">
      <Download className="size-4" aria-hidden="true" />
      Export CSV
    </button>
  );
}
