import { totalCentsToUnitCostText } from "./money";
import { baseToAmount, findUnit, unitFactor } from "./product-units";
import { computeLineTax, resolveProductTaxConfig, type TenantTaxConfig } from "./tax";
import type { CheckoutCartLine, MobileEditableItem, ProductListItem, ServiceChargeDraft, ServiceChargeInput } from "./types";
import { cartLineId } from "./variants";

export type CartLineTaxResult = { grossCents: number; netCents: number; taxCents: number };

/** The natural (no-override) price for a line at its CURRENT quantity — crossing the configured
 * wholesale threshold swaps the retail unitPriceCents for wholesalePriceCents, matching SERVER's own
 * prepareMobileCart condition exactly. */
export function naturalUnitPriceCents(line: CheckoutCartLine): number {
  // A pack with its own price beats wholesale, same as SERVER.
  const unit = findUnit(line.unitConfig ?? null, line.unitCode);
  if (unit?.priceCents != null) return unit.priceCents / unit.factor;
  if (line.wholesalePriceCents !== null && line.wholesaleMinQuantity > 0 && line.quantity >= line.wholesaleMinQuantity) {
    return line.wholesalePriceCents;
  }
  return line.unitPriceCents;
}

/** The override or the line's natural price — drives every downstream figure for a line (tax,
 * below-minimum check, line total). Shared by CheckoutTab and the Invoice/Quotation forms so all
 * three read the identical "effective price" a cart line is actually charging. An explicit override
 * always wins over wholesale, same as SERVER. */
export function effectiveUnitPriceCents(line: CheckoutCartLine): number {
  return linePriceOverrideCents(line) ?? naturalUnitPriceCents(line);
}

/** The typed price per base unit, or undefined. It's typed per the unit the line is sold in. */
export function linePriceOverrideCents(line: CheckoutCartLine): number | undefined {
  if (!line.priceOverride.trim()) return undefined;
  return Math.round(Number(line.priceOverride) * 100) / unitFactor(line.unitConfig ?? null, line.unitCode);
}

/** A per-base price as shown on this line: per kg when it's sold by the kg. */
export function linePriceInSaleUnitCents(line: CheckoutCartLine, basePriceCents: number): number {
  return Math.round(basePriceCents * unitFactor(line.unitConfig ?? null, line.unitCode));
}

/** How much of the sale unit this line is: 1.5 for 1500 g sold by the kg. */
export function lineAmountInSaleUnit(line: CheckoutCartLine): number {
  return baseToAmount(line.quantity, line.unitConfig ?? null, line.unitCode ?? null);
}

/** " kg" or " carton" after a quantity or price; empty when sold in the base unit. */
export function lineSaleUnitLabel(line: CheckoutCartLine): string {
  return line.unitCode ?? "";
}

export function computeCartLineTaxResults(cart: CheckoutCartLine[], tenantTaxConfig: TenantTaxConfig): CartLineTaxResult[] {
  return cart.map((line) => {
    const taxableCents = Math.round(effectiveUnitPriceCents(line) * line.quantity) - line.discountAmountCents;
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

/** Rows with no name or no fee are dropped silently — an empty trailing row (e.g. from "Add another
 * charge" left untouched) should never become a $0 charge on submit. Shared by Checkout/Invoice/
 * Quotation so the exact same filter/round rules apply everywhere a ServiceChargesModal is used. */
export function serviceChargeDraftsToInputs(drafts: ServiceChargeDraft[]): ServiceChargeInput[] {
  return drafts
    .filter((d) => d.name.trim() && d.fee.trim())
    .map((d) => ({
      name: d.name.trim(),
      feeCents: Math.round(Number(d.fee) * 100),
      costCents: d.cost.trim() ? Math.round(Number(d.cost) * 100) : 0,
    }));
}

export function sumServiceChargeDraftFeeCents(drafts: ServiceChargeDraft[]): number {
  return serviceChargeDraftsToInputs(drafts).reduce((sum, c) => sum + c.feeCents, 0);
}

export function serviceChargeInputsToDrafts(charges: ServiceChargeInput[]): ServiceChargeDraft[] {
  return charges.map((c) => ({ name: c.name, fee: (c.feeCents / 100).toFixed(2), cost: c.costCents ? (c.costCents / 100).toFixed(2) : "" }));
}

/** Rebuilds editable CheckoutCartLine[] from an existing document's raw items (see
 * MobileEditableItem — what GET /mobile/invoices|quotations/:id/edit returns) plus the CURRENT
 * product catalog. taxType/pricesTaxInclusive/minimumPriceCents always come from the LIVE product,
 * never the old item — matching what prepareMobileCart will actually re-validate against on submit,
 * same reasoning DESKTOP's own CheckoutRoute resume-draft logic uses. priceOverride is populated only
 * when the stored unit price differs from the product's own current selling price, so an unchanged
 * line shows no override badge. A product that's since been deleted/deactivated falls back to the
 * old item's own price with a generic tax guess — SERVER's own prepareMobileCart will reject it
 * clearly on submit if it's truly gone, so this is just a reasonable prefill, not the source of
 * truth. */
export function buildCartFromEditableItems(items: MobileEditableItem[], products: ProductListItem[]): CheckoutCartLine[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    const product = productById.get(item.productId);
    const wholesalePriceCents = product?.wholesalePriceCents ?? null;
    const wholesaleMinQuantity = product?.wholesaleMinQuantity ?? 0;
    const useWholesale = wholesalePriceCents !== null && wholesaleMinQuantity > 0 && item.quantity >= wholesaleMinQuantity;
    // A shared-stock variant's own price is its natural price (same as SERVER's prepareMobileCart).
    const variant = item.variantKey && product?.variants?.mode === "shared" ? product.variants.shared.find((v) => v.key === item.variantKey) : undefined;
    const basePriceCents = variant?.priceCents ?? product?.sellingPriceCents;
    const unitConfig = product?.unitConfig ?? null;
    const saleUnit = findUnit(unitConfig, item.unitCode);
    const unitCode = saleUnit?.code ?? null;
    const factor = saleUnit?.factor ?? 1;
    const naturalPriceCents =
      (saleUnit?.priceCents != null ? saleUnit.priceCents / factor : useWholesale ? wholesalePriceCents : basePriceCents) ?? item.unitPriceCents;
    const label = variant?.label ?? item.variantLabel ?? null;
    return {
      lineId: cartLineId(item.productId, item.variantKey),
      productId: item.productId,
      variantKey: item.variantKey ?? null,
      sectionLabel: item.sectionLabel ?? null,
      name: label ? `${product?.name ?? "Unknown product"} — ${label}` : (product?.name ?? "Unknown product"),
      sku: product?.sku ?? "",
      unitPriceCents: basePriceCents ?? item.unitPriceCents,
      quantity: item.quantity,
      unitOfMeasure: product?.unitOfMeasure ?? null,
      unitConfig,
      unitCode,
      discountAmountCents: item.discountAmountCents,
      taxType: product?.taxType ?? "vat",
      pricesTaxInclusive: product?.pricesTaxInclusive ?? null,
      minimumPriceCents: product?.minimumPriceCents ?? null,
      wholesalePriceCents,
      wholesaleMinQuantity,
      // Compared with a tolerance — a fractional per-base price can differ in the last float digits.
      priceOverride: Math.abs(item.unitPriceCents - naturalPriceCents) > 1e-6 ? ((item.unitPriceCents * factor) / 100).toFixed(2) : "",
      isLocallySourced: item.isLocallySourced,
      // item.localCostCents is stored as the TOTAL for this line — back it out to the per-unit
      // figure this field shows (see money.ts's own doc comment on the pair).
      localCost: totalCentsToUnitCostText(item.localCostCents, item.quantity / factor),
      localSupplierId: item.localSupplierId,
      stockSource: item.stockSource,
    };
  });
}
