"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { formatCents } from "@/lib/money";

export type CardTone = "navy" | "blue" | "red" | "green" | "gold";
const TONE_BG: Record<CardTone, string> = { navy: "bg-navy", blue: "bg-blue", red: "bg-red", green: "bg-green", gold: "bg-gold" };

/** Concentric rings bleeding off the top-right corner — ported from DESKTOP's own CardTexture
 * (FinancialOverviewCards.tsx), the "fingerprint" texture matching this project's own established
 * "colorful/textured cards, never plain white" preference. Extracted here (previously duplicated
 * inline in SalesReportSection.tsx) so every dashboard variant shares one implementation. */
export function CardTexture() {
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

/** The one colorful/textured stat-card shape this whole app uses — pass EITHER `deltaPercent`
 * (period-over-period comparison, shows a trend badge) OR `footnote` (a plain caption like "So far
 * today", DESKTOP's own CashierDashboard convention for a card that has nothing to compare against
 * within a single day). Pass `valueCents` for a money figure or `displayValue` for anything else
 * (a count, an average already formatted, etc). */
export function OverviewCard({
  tone,
  label,
  valueCents,
  displayValue,
  currency,
  formula,
  deltaPercent,
  footnote,
}: {
  tone: CardTone;
  label: string;
  valueCents?: number;
  displayValue?: string;
  currency?: string;
  formula: string;
  deltaPercent?: number | null;
  footnote?: string;
}) {
  const value = displayValue ?? formatCents(valueCents ?? 0, currency ?? "KES");
  return (
    <div className={`relative overflow-hidden rounded-lg p-4 shadow-sm ${TONE_BG[tone]}`}>
      <CardTexture />
      <div className="relative">
        <p className="text-[11px] font-bold tracking-wide text-white/75 uppercase">{label}</p>
        <p className="mt-2 font-display text-xl text-white">{value}</p>
        <p className="mt-1.5 text-[11px] font-semibold text-white/60">{formula}</p>
        <div className="mt-2.5">{footnote ? <span className="text-[11px] font-semibold text-white/60">{footnote}</span> : <DeltaBadge percent={deltaPercent ?? null} />}</div>
      </div>
    </div>
  );
}
