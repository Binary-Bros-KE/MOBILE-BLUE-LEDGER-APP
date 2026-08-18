import type { TaxPricingMode, TaxType } from "@/lib/types";

/** Ported from SERVER's src/lib/tax-breakdown.ts (taxBreakdownLabel) — "Standard (16%)" uses the
 * tenant's own configured rate, never a hardcoded percentage, with an " — Inclusive"/" — Exclusive"
 * suffix when pricingMode is given. */
export function taxBreakdownLabel(taxType: TaxType, vatRatePercent: number, pricingMode?: TaxPricingMode | null): string {
  if (taxType === "vat") {
    const base = `Standard (${vatRatePercent}%)`;
    if (pricingMode === "inclusive") return `${base} — Inclusive`;
    if (pricingMode === "exclusive") return `${base} — Exclusive`;
    return base;
  }
  if (taxType === "exempted") return "Exempted";
  return "Zero-Rated";
}
