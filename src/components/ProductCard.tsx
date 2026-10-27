"use client";

import { Archive, ArchiveRestore, Boxes, Package, Pencil } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { ProductListItem } from "@/lib/types";

/** Each action is shown only when its handler is passed — ProductsTab passes them per the viewer's
 * own products.edit / inventory.edit grants. */
export type ProductCardActions = {
  onAdjustStock?: () => void;
  onEdit?: () => void;
  onToggleArchive?: () => void;
};

/** At-a-glance stock card — no tap-to-open-modal (unlike every other card in this app), since
 * there's no further "detail" beyond what's already shown here. Management (stock change, edit,
 * archive) is a row of buttons along the bottom, only when `actions` grants them.
 *
 * mainStoreQuantity is null when the tenant has no Main Store location at all — shown as "—" rather
 * than 0, since those mean different things (no Main Store vs. a Main Store that's empty). Every
 * storefront gets its OWN line (not a summed total) — per explicit client ask, "not just a sum of
 * all storefronts." */
export function ProductCard({ product, currency, actions }: { product: ProductListItem; currency: string; actions?: ProductCardActions }) {
  const archived = product.status === "inactive";
  const flagTone = archived
    ? "border-navy/30 text-navy/50"
    : product.outOfStock
      ? "border-red text-red"
      : product.lowStock
        ? "border-gold text-gold-text"
        : null;
  const flagLabel = archived ? "Archived" : !product.trackStock ? "No stock tracking" : product.outOfStock ? "Out of Stock" : product.lowStock ? "Low Stock" : null;
  const hasActions = Boolean(actions?.onAdjustStock || actions?.onEdit || actions?.onToggleArchive);

  return (
    <div className={`flex w-full flex-col gap-1.5 rounded-lg bg-white p-4 shadow-sm ${archived ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
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
      </div>
      <div className="flex items-center justify-between gap-2 pl-14">
        <p className={`font-display text-xs font-black leading-none ${product.totalQuantity > 0 ? "text-green" : "text-red"}`}>
          STOCK: {product.totalQuantity}
        </p>
        {flagLabel && (
          <span className={`flex-none rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${flagTone ?? "border-navy/30 text-navy/50"}`}>
            {flagLabel}
          </span>
        )}
      </div>
      {hasActions && (
        // Full card width (not indented under the name) with equal-width buttons, so the row can never
        // be wider than the screen and push the page sideways.
        <div className="mt-1.5 flex gap-2 border-t border-dashed border-navy/15 pt-2.5">
          {actions?.onAdjustStock && product.trackStock && !archived && (
            <CardAction icon={Boxes} label="Stock" onClick={actions.onAdjustStock} primary />
          )}
          {actions?.onEdit && <CardAction icon={Pencil} label="Edit" onClick={actions.onEdit} />}
          {actions?.onToggleArchive && (
            <CardAction icon={archived ? ArchiveRestore : Archive} label={archived ? "Restore" : "Archive"} onClick={actions.onToggleArchive} />
          )}
        </div>
      )}
    </div>
  );
}

function CardAction({ icon: Icon, label, onClick, primary }: { icon: typeof Package; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-bold ${
        primary ? "border-blue bg-blue text-white" : "border-navy/15 text-navy hover:bg-cream-dark"
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
