"use client";

import { useRef, useState } from "react";
import { CHART_AXIS_TEXT, CHART_GRIDLINE, CHART_SEQUENTIAL_HUE } from "@/lib/chartTokens";

export type TrendPoint = {
  label: string;
  value: number;
  isSelected?: boolean;
};

const WIDTH = 720;
const HEIGHT = 220;
const PADDING_LEFT = 48;
const PADDING_RIGHT = 16;
const PADDING_TOP = 24;
const PADDING_BOTTOM = 28;

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niced = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niced * magnitude;
}

/** Ported near-verbatim from DESKTOP's own TrendAreaChart.tsx — same hand-rolled SVG approach (no
 * charting dependency, matching what DESKTOP itself does), same crosshair-tooltip-on-nearest-point
 * interaction, same isSelected-point direct-labeling. Only the Tailwind color tokens changed
 * (DESKTOP's text-muted/border-line/bg-soft/text-ink don't exist in APP's palette). */
export function TrendAreaChart({ title, points, formatValue }: { title?: string; points: TrendPoint[]; formatValue: (value: number) => string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div>
        {title && <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-navy/50">{title}</p>}
        <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-navy/15 bg-cream-dark/40 text-sm font-semibold text-navy/50">
          No data for this period.
        </div>
      </div>
    );
  }

  const maxValue = niceMax(Math.max(...points.map((p) => p.value)));
  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const xFor = (index: number): number =>
    points.length === 1 ? PADDING_LEFT + plotWidth / 2 : PADDING_LEFT + (index / (points.length - 1)) * plotWidth;
  const yFor = (value: number): number => PADDING_TOP + plotHeight - (value / maxValue) * plotHeight;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.value)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(points.length - 1)} ${PADDING_TOP + plotHeight} L ${xFor(0)} ${PADDING_TOP + plotHeight} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => maxValue * fraction);

  const labelStep = Math.max(1, Math.ceil(points.length / 7));
  const selectedIndex = points.findIndex((p) => p.isSelected);
  const directLabelIndex = selectedIndex >= 0 ? selectedIndex : points.length - 1;
  const directLabelPoint = points[directLabelIndex];

  function handleMove(event: React.MouseEvent<SVGSVGElement>): void {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDistance = Infinity;
    points.forEach((_, index) => {
      const distance = Math.abs(xFor(index) - relativeX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div>
      {title && <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-navy/50">{title}</p>}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ height: HEIGHT }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            if (!touch) return;
            handleMove({ clientX: touch.clientX } as React.MouseEvent<SVGSVGElement>);
          }}
          role="img"
          aria-label={title ?? "Revenue trend over the selected period"}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PADDING_LEFT} x2={WIDTH - PADDING_RIGHT} y1={yFor(tick)} y2={yFor(tick)} stroke={CHART_GRIDLINE} strokeWidth={1} />
              <text x={PADDING_LEFT - 8} y={yFor(tick)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={CHART_AXIS_TEXT}>
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {points.map((p, i) =>
            i % labelStep === 0 || i === points.length - 1 ? (
              <text
                key={p.label + i}
                x={xFor(i)}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize={10}
                fontWeight={p.isSelected ? 700 : 400}
                fill={p.isSelected ? "#16204a" : CHART_AXIS_TEXT}
              >
                {p.label}
              </text>
            ) : null,
          )}

          <path d={areaPath} fill={CHART_SEQUENTIAL_HUE} opacity={0.1} stroke="none" />
          <path d={linePath} fill="none" stroke={CHART_SEQUENTIAL_HUE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {points.map((p, i) =>
            p.isSelected ? null : <circle key={`dot-${p.label}-${i}`} cx={xFor(i)} cy={yFor(p.value)} r={3} fill={CHART_SEQUENTIAL_HUE} opacity={0.55} />,
          )}

          {directLabelPoint && (
            <>
              {selectedIndex >= 0 && (
                <line
                  x1={xFor(directLabelIndex)}
                  x2={xFor(directLabelIndex)}
                  y1={PADDING_TOP}
                  y2={PADDING_TOP + plotHeight}
                  stroke={CHART_SEQUENTIAL_HUE}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.35}
                />
              )}
              <circle
                cx={xFor(directLabelIndex)}
                cy={yFor(directLabelPoint.value)}
                r={selectedIndex >= 0 ? 6 : 4}
                fill={CHART_SEQUENTIAL_HUE}
                stroke="#f4eee1"
                strokeWidth={2}
              />
              <text x={xFor(directLabelIndex)} y={yFor(directLabelPoint.value) - 12} textAnchor="middle" fontSize={11} fontWeight={700} fill="#16204a">
                {formatValue(directLabelPoint.value)}
              </text>
            </>
          )}

          {hovered && hoverIndex !== null && hoverIndex !== directLabelIndex && (
            <g>
              <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={PADDING_TOP} y2={PADDING_TOP + plotHeight} stroke={CHART_GRIDLINE} strokeWidth={1} />
              <circle cx={xFor(hoverIndex)} cy={yFor(hovered.value)} r={5} fill={CHART_SEQUENTIAL_HUE} stroke="#f4eee1" strokeWidth={2} />
            </g>
          )}
        </svg>

        {hovered && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-md border border-navy/15 bg-navy px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm"
            style={{ left: `${(xFor(hoverIndex) / WIDTH) * 100}%` }}
          >
            <div className="text-white/70">{hovered.label}</div>
            <div>{formatValue(hovered.value)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
