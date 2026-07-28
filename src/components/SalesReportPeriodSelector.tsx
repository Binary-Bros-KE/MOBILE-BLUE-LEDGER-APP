"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  defaultAnchorForMode,
  isoWeekFromMonday,
  maxAnchorForMode,
  mondayFromIsoWeek,
  periodLabelForAnchor,
  shiftAnchor,
  todayIso,
  type SalesReportMode,
} from "@/lib/period";
import type { SalesReportPeriodInput } from "@/lib/types";

const MODES: { key: SalesReportMode; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
  { key: "custom", label: "Custom" },
];

function defaultCustomRange(): { startDate: string; endDate: string } {
  const end = todayIso();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate: end };
}

/** Phone-width adaptation of DESKTOP's SalesModeSelector.tsx — same 5-mode pill row + grain-matched
 * native picker + prev/next stepper (clamped so you can't step into the future), just stacked
 * vertically instead of one wide horizontal row. */
export function SalesReportPeriodSelector({ value, onChange }: { value: SalesReportPeriodInput; onChange: (next: SalesReportPeriodInput) => void }) {
  const mode = value.mode;
  const isWindowed = mode !== "custom";
  const anchor = value.mode === "custom" ? "" : value.anchor;
  const maxAnchor = isWindowed ? maxAnchorForMode(mode) : todayIso();
  const canStepForward = isWindowed && shiftAnchor(mode, anchor, 1) <= maxAnchor;

  function handleModeChange(nextMode: SalesReportMode): void {
    if (nextMode === "custom") {
      onChange({ mode: "custom", ...defaultCustomRange() });
    } else {
      onChange({ mode: nextMode, anchor: defaultAnchorForMode(nextMode) });
    }
  }

  function handleAnchorChange(nextAnchor: string): void {
    if (mode === "custom") return;
    onChange({ mode, anchor: nextAnchor });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-navy/15 bg-white p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MODES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleModeChange(item.key)}
            className={`flex-none rounded-md px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase transition ${
              mode === item.key ? "bg-navy text-white" : "text-navy/50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isWindowed && (
        <div className="flex items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-2 py-2">
          <button
            type="button"
            onClick={() => handleAnchorChange(shiftAnchor(mode, anchor, -1))}
            aria-label="Previous period"
            className="grid size-7 flex-none place-items-center rounded text-navy/50 hover:bg-cream-dark"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            {mode === "daily" && (
              <input
                type="date"
                value={anchor}
                max={maxAnchor}
                onChange={(event) => event.target.value && handleAnchorChange(event.target.value)}
                className="w-full border-none bg-transparent text-xs font-bold text-navy outline-none"
              />
            )}
            {mode === "weekly" && (
              <input
                type="week"
                value={isoWeekFromMonday(anchor)}
                max={isoWeekFromMonday(maxAnchor)}
                onChange={(event) => {
                  const monday = mondayFromIsoWeek(event.target.value);
                  if (monday) handleAnchorChange(monday);
                }}
                className="w-full border-none bg-transparent text-xs font-bold text-navy outline-none"
              />
            )}
            {mode === "monthly" && (
              <input
                type="month"
                value={anchor}
                max={maxAnchor}
                onChange={(event) => event.target.value && handleAnchorChange(event.target.value)}
                className="w-full border-none bg-transparent text-xs font-bold text-navy outline-none"
              />
            )}
            {mode === "yearly" && (
              <input
                type="number"
                value={anchor}
                max={maxAnchor}
                min={2000}
                onChange={(event) => /^\d{4}$/.test(event.target.value) && handleAnchorChange(event.target.value)}
                className="w-full border-none bg-transparent text-xs font-bold text-navy outline-none"
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => canStepForward && handleAnchorChange(shiftAnchor(mode, anchor, 1))}
            disabled={!canStepForward}
            aria-label="Next period"
            className="grid size-7 flex-none place-items-center rounded text-navy/50 hover:bg-cream-dark disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {isWindowed && <p className="px-1 text-[11px] font-semibold text-navy/50">{periodLabelForAnchor(mode, anchor)}</p>}

      {value.mode === "custom" && (
        <div className="flex items-center gap-2 rounded-lg border border-navy/15 bg-white px-3 py-2">
          <input
            type="date"
            value={value.startDate}
            max={value.endDate}
            onChange={(event) => onChange({ mode: "custom", startDate: event.target.value, endDate: value.endDate })}
            className="min-w-0 flex-1 border-none bg-transparent text-xs font-bold text-navy outline-none"
          />
          <span className="flex-none text-xs font-bold text-navy/50">to</span>
          <input
            type="date"
            value={value.endDate}
            min={value.startDate}
            max={todayIso()}
            onChange={(event) => onChange({ mode: "custom", startDate: value.startDate, endDate: event.target.value })}
            className="min-w-0 flex-1 border-none bg-transparent text-xs font-bold text-navy outline-none"
          />
        </div>
      )}
    </div>
  );
}
