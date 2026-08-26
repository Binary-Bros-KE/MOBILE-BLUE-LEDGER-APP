"use client";

import { Package } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { ProductListItem } from "@/lib/types";

/** Read-only, at-a-glance stock card — no tap-to-open-modal (unlike every other card in this app),
 * since there's no further "detail" beyond what's already shown here; the user only asked for a
 * list plus Low Stock / Out of Stock filtering, not a drill-down view.
 *
 * mainStoreQuantity is null when the tenant has no Main Store location at all — shown as "—" rather
 * than 0, since those mean different things (no Main Store vs. a Main Store that's empty). Every
 * storefront gets its OWN line (not a summed total) — per explicit client ask, "not just a sum of
 * all storefronts." */
export function ProductCard({ product, currency }: { product: ProductListItem; currency: string }) {
  const flagTone = product.outOfStock ? "border-red text-red" : product.lowStock ? "border-gold text-gold-text" : null;
  const flagLabel = product.outOfStock ? "Out of Stock" : product.lowStock ? "Low Stock" : null;

  return (
    <div className="flex w-full items-start gap-3 rounded-lg bg-white p-4 shadow-sm">
      <div className="grid size-11 flex-none place-items-center rounded-full bg-navy text-white">
        <Package className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="break-words font-bold text-navy">{product.name}</p>
          <p className="flex-none font-display text-sm text-navy">{formatCents(product.sellingPriceCents, currency)}</p>
        </div>
        <p className="text-xs text-navy/50">
          {product.sku}
          {product.categoryName && ` · ${product.categoryName}`}
        </p>
        <div className="mt-1.5 space-y-0.5 text-[11px] text-navy/70">
          <p>
            Main Store: <span className="font-bold text-navy">{product.mainStoreQuantity ?? "—"}</span>
          </p>
          {(product.storefrontBreakdown ?? []).map((entry) => (
            <p key={entry.locationId}>
              {entry.locationName}: <span className="font-bold text-navy">{entry.quantity}</span>
            </p>
          ))}
        </div>
      </div>
      {flagLabel && (
        <span className={`flex-none rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${flagTone}`}>
          {flagLabel}
        </span>
      )}
    </div>
  );
}
