import type { TaxType } from "@/lib/types";

/** Ported from SERVER's src/lib/tax-breakdown.ts (taxBreakdownLabel) — "Standard (16%)" uses the
 * tenant's own configured rate, never a hardcoded percentage. */
export function taxBreakdownLabel(taxType: TaxType, vatRatePercent: number): string {
  if (taxType === "vat") return `Standard (${vatRatePercent}%)`;
  if (taxType === "exempted") return "Exempted";
  return "Zero-Rated";
}
