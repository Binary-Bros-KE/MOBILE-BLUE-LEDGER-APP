// Ported verbatim from SERVER's src/lib/tax-breakdown.ts (itself ported from DESKTOP's
// shared/lib/tax-calculation.ts) — the ONE place besides SERVER's mobile-checkout-service.ts that
// needs to agree on this math: Checkout's cart preview must show the SAME real, tax-inclusive total
// SERVER will enforce at submit time, or a cashier can type exactly what the screen shows and still
// have the sale rejected as underpaid (caught live: a tax-exclusive product's naive pre-tax preview
// total was always short of the real charge — 2026-08-25).

import type { TaxPricingMode, TaxType } from "@/lib/types";

/** "Standard (16%)" uses the tenant's own configured rate, never a hardcoded percentage, with an
 * " — Inclusive"/" — Exclusive" suffix when pricingMode is given. */
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

export type TenantTaxConfig = { vatRatePercent: number; pricesTaxInclusive: boolean };

export type LineTaxResult = { grossCents: number; netCents: number; taxCents: number };

export function resolveProductTaxConfig(
  product: { pricesTaxInclusive: boolean | null },
  tenantTaxConfig: TenantTaxConfig,
): TenantTaxConfig {
  return {
    vatRatePercent: tenantTaxConfig.vatRatePercent,
    pricesTaxInclusive: product.pricesTaxInclusive ?? tenantTaxConfig.pricesTaxInclusive,
  };
}

export function computeLineTax(amountCents: number, taxType: string, tenantTaxConfig: TenantTaxConfig): LineTaxResult {
  if (taxType !== "vat") {
    return { grossCents: amountCents, netCents: amountCents, taxCents: 0 };
  }

  if (tenantTaxConfig.pricesTaxInclusive) {
    const netCents = Math.round(amountCents / (1 + tenantTaxConfig.vatRatePercent / 100));
    return { grossCents: amountCents, netCents, taxCents: amountCents - netCents };
  }

  const taxCents = Math.round(amountCents * (tenantTaxConfig.vatRatePercent / 100));
  return { grossCents: amountCents + taxCents, netCents: amountCents, taxCents };
}
