import type { CheckoutCartLine, ProductListItem } from "./types";

// Product variants in the Owner App (SERVER lib/variants.ts, DESKTOP docs/VARIANTS.md).
//  - shared stock: one product, one stock — a cart line carries the variant's key; SERVER prices it
//  - separate stock: each variant is its own product, grouped by variants.groupId — picking one just
//    puts that product in the cart.

/** What the picker hands back. */
export type VariantPick = { product: ProductListItem; variantKey: string | null; label: string | null; priceCents: number };

/** A plain product as a pick (no variant). */
export function plainPick(product: ProductListItem): VariantPick {
  return { product, variantKey: null, label: null, priceCents: product.sellingPriceCents };
}

/** Line identity in a cart: the same product in two colours is two lines. */
export function cartLineId(productId: string, variantKey: string | null | undefined): string {
  return variantKey ? `${productId}::${variantKey}` : productId;
}

/** Sellable products of the separate-stock group this product is in (itself included), in the
 * group's option order — empty when it isn't in one. */
export function separateGroupMembers(product: ProductListItem, products: ProductListItem[]): ProductListItem[] {
  const groupId = product.variants?.mode === "separate" ? product.variants.groupId : null;
  if (!groupId) return [];
  const options = product.variants?.options ?? [];
  const rank = (p: ProductListItem): number[] =>
    options.map((o) => {
      const i = o.values.indexOf(p.variants?.values[o.name] ?? "");
      return i < 0 ? 999 : i;
    });
  return products
    .filter((p) => p.variants?.mode === "separate" && p.variants.groupId === groupId)
    .sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return (ra[i] ?? 0) - (rb[i] ?? 0);
      return a.name.localeCompare(b.name);
    });
}

/** Tapping this product should ask "which one?" first. */
export function needsVariantPicker(product: ProductListItem, products: ProductListItem[]): boolean {
  if (product.variants?.mode === "shared") return product.variants.shared.length > 0;
  return separateGroupMembers(product, products).length >= 2;
}

/** A new cart line for a pick — shared by Checkout and the Invoice/Quotation item editor. */
export function newCartLine(pick: VariantPick): CheckoutCartLine {
  const { product } = pick;
  return {
    lineId: cartLineId(product.id, pick.variantKey),
    productId: product.id,
    variantKey: pick.variantKey,
    name: pick.label ? `${product.name} — ${pick.label}` : product.name,
    sku: product.sku,
    unitPriceCents: pick.priceCents,
    quantity: 1,
    discountAmountCents: 0,
    taxType: product.taxType,
    pricesTaxInclusive: product.pricesTaxInclusive,
    minimumPriceCents: product.minimumPriceCents,
    wholesalePriceCents: product.wholesalePriceCents,
    wholesaleMinQuantity: product.wholesaleMinQuantity,
    priceOverride: "",
    isLocallySourced: false,
    localCost: "",
    localSupplierId: null,
    sectionLabel: null,
  };
}

/** Add a pick to a cart: bumps the quantity of the same product+variant line, else appends. */
export function addPickToCart(cart: CheckoutCartLine[], pick: VariantPick): CheckoutCartLine[] {
  const lineId = cartLineId(pick.product.id, pick.variantKey);
  return cart.some((line) => line.lineId === lineId)
    ? cart.map((line) => (line.lineId === lineId ? { ...line, quantity: line.quantity + 1 } : line))
    : [...cart, newCartLine(pick)];
}
