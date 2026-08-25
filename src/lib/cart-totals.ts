import { computeLineTax, resolveProductTaxConfig, type TenantTaxConfig } from "./tax";
import type { CheckoutCartLine } from "./types";

export type CartLineTaxResult = { grossCents: number; netCents: number; taxCents: number };

/** The override or the product's natural price — drives every downstream figure for a line (tax,
 * below-minimum check, line total). Shared by CheckoutTab and the Invoice/Quotation forms so all
 * three read the identical "effective price" a cart line is actually charging. */
export function effectiveUnitPriceCents(line: CheckoutCartLine): number {
  return line.priceOverride.trim() ? Math.round(Number(line.priceOverride) * 100) : line.unitPriceCents;
}

export function computeCartLineTaxResults(cart: CheckoutCartLine[], tenantTaxConfig: TenantTaxConfig): CartLineTaxResult[] {
  return cart.map((line) => {
    const taxableCents = effectiveUnitPriceCents(line) * line.quantity - line.discountAmountCents;
    const productTaxConfig = resolveProductTaxConfig({ pricesTaxInclusive: line.pricesTaxInclusive }, tenantTaxConfig);
    return computeLineTax(taxableCents, line.taxType, productTaxConfig);
  });
}

export type CartTotals = {
  lineTaxResults: CartLineTaxResult[];
  netSubtotalCents: number;
  taxAmountCents: number;
  /** Items only — never includes a delivery fee, same convention as SERVER's prepareMobileCart. */
  itemsGrandTotalCents: number;
};

export function computeCartTotals(cart: CheckoutCartLine[], tenantTaxConfig: TenantTaxConfig): CartTotals {
  const lineTaxResults = computeCartLineTaxResults(cart, tenantTaxConfig);
  return {
    lineTaxResults,
    netSubtotalCents: lineTaxResults.reduce((sum, r) => sum + r.netCents, 0),
    taxAmountCents: lineTaxResults.reduce((sum, r) => sum + r.taxCents, 0),
    itemsGrandTotalCents: lineTaxResults.reduce((sum, r) => sum + r.grossCents, 0),
  };
}
