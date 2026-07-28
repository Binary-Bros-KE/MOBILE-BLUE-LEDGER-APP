/**
 * Chart color tokens for the Owner App's Sales Report — ported from DESKTOP's own
 * shared/components/charts/chartTokens.ts. The 8-hue categorical palette and the axis/gridline
 * grays are reused VERBATIM (not just "similar") so a payment method's bar color matches between
 * DESKTOP and mobile at the same rank position — a small but real fidelity win. Only the sequential
 * hue is swapped for APP's own --color-blue (#2f5fe0) rather than DESKTOP's --color-accent
 * (#2b5fd9) — the two apps' blues are close but not identical, and this one should match APP's own
 * brand, not desktop's.
 */
export const CHART_SEQUENTIAL_HUE = "#2f5fe0"; // matches --color-blue
export const CHART_SEQUENTIAL_HUE_SOFT = "rgba(47, 95, 224, 0.12)";

export const CHART_CATEGORICAL_PALETTE = [
  "#2a78d6", // blue
  "#008300", // green
  "#e87ba4", // magenta
  "#eda100", // yellow
  "#1baf7a", // aqua
  "#eb6834", // orange
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

export const CHART_GRIDLINE = "#ddd5c2";
export const CHART_AXIS_TEXT = "#83795f";

export function categoricalColor(index: number): string {
  return CHART_CATEGORICAL_PALETTE[index % CHART_CATEGORICAL_PALETTE.length] ?? CHART_SEQUENTIAL_HUE;
}
