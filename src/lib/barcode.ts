import type { ProductListItem } from "./types";
import { plainPick, type VariantPick } from "./variants";

/**
 * What a scanned (or typed) code points at: a product's own barcode or SKU, or a shared-stock
 * variant's own barcode/SKU — in which case the pick is that exact variant, never the picker. Case-
 * insensitive and whitespace-trimmed, since hardware scanners and people type codes differently.
 * Null when nothing matches.
 */
export function findPickByCode(products: ProductListItem[], rawCode: string): VariantPick | null {
  const code = rawCode.trim().toLowerCase();
  if (!code) return null;

  for (const product of products) {
    if (product.barcode?.toLowerCase() === code || product.sku.toLowerCase() === code) return plainPick(product);
  }
  for (const product of products) {
    if (product.variants?.mode !== "shared") continue;
    const variant = product.variants.shared.find((v) => v.barcode?.toLowerCase() === code || v.sku?.toLowerCase() === code);
    if (variant) {
      return { product, variantKey: variant.key, label: variant.label, priceCents: variant.priceCents ?? product.sellingPriceCents };
    }
  }
  return null;
}
