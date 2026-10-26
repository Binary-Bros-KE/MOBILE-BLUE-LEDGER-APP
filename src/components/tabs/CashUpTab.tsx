"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Share2, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents, priceTextToCents } from "@/lib/money";
import { timezoneOffsetMinutes } from "@/lib/period";
import type { MobileCashUp, MobileLocation } from "@/lib/types";
import { FilterChip } from "../FilterChip";

const ALL = "__all__";

/** Today in the phone's own timezone as YYYY-MM-DD. */
function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * End-of-day cash-up: what came in by payment method, and how much cash should be in the drawer —
 * type what you counted and it shows over/short. A cashier sees their own; with reports.view you can
 * switch to everyone (with a per-cashier breakdown) and, as a Super Admin, pick the storefront.
 * Nothing is stored — it's a live report (SERVER's mobile-cashup-service.ts), shareable as text.
 */
export function CashUpTab({
  canSeeEveryone,
  viewerIsSuperAdmin,
  currentEmployeeId,
}: {
  canSeeEveryone: boolean;
  viewerIsSuperAdmin: boolean;
  currentEmployeeId: string | null;
}) {
  const [date, setDate] = useState(localToday());
  const [everyone, setEveryone] = useState(canSeeEveryone);
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [locationId, setLocationId] = useState(ALL);
  const [report, setReport] = useState<MobileCashUp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counted, setCounted] = useState("");

  useEffect(() => {
    if (!viewerIsSuperAdmin) return;
    api
      .listStorefronts()
      .then(setLocations)
      .catch(() => {
        // Falls back to "all storefronts" only.
      });
  }, [viewerIsSuperAdmin]);

  useEffect(() => {
    let cancelled = false;
    api
      .getCashUp({
        date,
        timezoneOffsetMinutes: timezoneOffsetMinutes(),
        locationId: locationId === ALL ? undefined : locationId,
        employeeId: everyone ? undefined : (currentEmployeeId ?? undefined),
      })
      .then((r) => {
        if (!cancelled) {
          setReport(r);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load the cash-up.");
      });
    return () => {
      cancelled = true;
    };
  }, [date, locationId, everyone, currentEmployeeId]);

  const money = (cents: number) => formatCents(cents, report?.currency ?? "KES");
  const countedCents = counted.trim() ? priceTextToCents(counted) : null;
  const differenceCents = report && countedCents !== null ? countedCents - report.expectedCashCents : null;

  const shareText = useMemo(() => {
    if (!report) return "";
    const lines = [
      `Cash-up ${report.date}${report.locationName ? ` · ${report.locationName}` : ""}`,
      ...report.byMethod.map((m) => `${m.name}: ${money(m.amountCents)}`),
      `Total collected: ${money(report.totalCollectedCents)} (${report.salesCount} sales)`,
      `Expected cash: ${money(report.expectedCashCents)}`,
    ];
    if (countedCents !== null && differenceCents !== null) {
      lines.push(`Counted cash: ${money(countedCents)}`, `${differenceCents >= 0 ? "Over" : "Short"}: ${money(Math.abs(differenceCents))}`);
    }
    return lines.join("\n");
    // money only depends on report.currency, already covered by report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, countedCents, differenceCents]);

  async function share(): Promise<void> {
    try {
      if (navigator.share) await navigator.share({ title: "Cash-up", text: shareText });
      else await navigator.clipboard.writeText(shareText);
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  }

  return (
    <div className="space-y-4 px-4 py-4 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          max={localToday()}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 rounded-lg border border-navy/15 bg-white px-2.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
        />
        {canSeeEveryone && (
          <>
            <FilterChip label="Everyone" active={everyone} onClick={() => setEveryone(true)} />
            <FilterChip label="Just me" active={!everyone} onClick={() => setEveryone(false)} />
          </>
        )}
      </div>
      {locations && locations.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip label="All storefronts" active={locationId === ALL} onClick={() => setLocationId(ALL)} />
          {locations.map((l) => (
            <FilterChip key={l.id} label={l.locationName} active={locationId === l.id} onClick={() => setLocationId(l.id)} />
          ))}
        </div>
      )}

      {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
      {!report && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}

      {report && (
        <>
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-[11px] font-extrabold tracking-wide text-navy/50 uppercase">Collected</p>
            <p className="font-display text-2xl text-navy">{money(report.totalCollectedCents)}</p>
            <p className="text-xs text-navy/50">
              {report.salesCount} sale{report.salesCount === 1 ? "" : "s"}
              {report.voidedCount > 0 ? ` · ${report.voidedCount} voided (not counted)` : ""}
            </p>
            <div className="mt-3 space-y-1.5 border-t border-navy/10 pt-3">
              {report.byMethod.length === 0 && <p className="text-xs text-navy/50">Nothing collected yet.</p>}
              {report.byMethod.map((m) => (
                <div key={m.paymentMethodId} className="flex items-center justify-between text-sm">
                  <span className="text-navy/70">
                    {m.name} <span className="text-xs text-navy/40">×{m.count}</span>
                  </span>
                  <span className="font-bold text-navy">{money(m.amountCents)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-white p-4 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-navy/50 uppercase">
              <Banknote className="size-3.5" aria-hidden="true" />
              Cash in the drawer
            </p>
            <div className="space-y-1 text-sm">
              <Row label="Cash collected" value={money(report.byMethod.filter((m) => m.isCash).reduce((s, m) => s + m.amountCents, 0))} />
              {report.refundsCents > 0 && <Row label="Refunds given" value={`− ${money(report.refundsCents)}`} />}
              {report.cashExpensesCents > 0 && <Row label="Paid out (cash expenses)" value={`− ${money(report.cashExpensesCents)}`} />}
              <div className="flex items-center justify-between border-t border-dashed border-navy/15 pt-1.5">
                <span className="font-bold text-navy">Expected cash</span>
                <span className="font-display text-lg text-navy">{money(report.expectedCashCents)}</span>
              </div>
            </div>
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold text-navy/50">Cash you counted</span>
              <input
                inputMode="decimal"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="Count the drawer and enter it here"
                className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
              />
            </label>
            {differenceCents !== null && (
              <p className={`mt-2 text-sm font-bold ${differenceCents === 0 ? "text-green" : differenceCents > 0 ? "text-gold-text" : "text-red"}`}>
                {differenceCents === 0 ? "Balanced ✓" : `${differenceCents > 0 ? "Over" : "Short"} by ${money(Math.abs(differenceCents))}`}
              </p>
            )}
            {report.refundsCents > 0 && <p className="mt-2 text-[11px] text-navy/40">Refunds are assumed to have been paid out in cash.</p>}
          </section>

          {report.byCashier && report.byCashier.length > 0 && (
            <section className="rounded-lg bg-white p-4 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-navy/50 uppercase">
                <Users className="size-3.5" aria-hidden="true" />
                By cashier
              </p>
              <div className="space-y-1.5">
                {report.byCashier.map((c) => (
                  <div key={c.employeeId} className="flex items-center justify-between text-sm">
                    <span className="text-navy/70">
                      {c.name} <span className="text-xs text-navy/40">· {c.salesCount} sales</span>
                    </span>
                    <span className="font-bold text-navy">{money(c.amountCents)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={() => void share()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-navy/20 py-3 text-sm font-bold text-navy"
          >
            <Share2 className="size-4" aria-hidden="true" />
            Share cash-up
          </button>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-navy/70">{label}</span>
      <span className="font-semibold text-navy">{value}</span>
    </div>
  );
}
