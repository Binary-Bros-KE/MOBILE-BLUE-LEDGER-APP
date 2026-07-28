"use client";

import { Package, Store } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { StockMovementRow as StockMovementRowType, StockMovementType } from "@/lib/types";

const INCREASING_TYPES = new Set<StockMovementType>(["purchase", "transfer_in", "return", "opening_stock"]);

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  purchase: "Purchase",
  sale: "Sale",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  return: "Return",
  damage: "Damage / Loss",
  adjustment: "Adjustment",
  opening_stock: "Opening Stock",
};

function movementTone(type: StockMovementType): string {
  if (INCREASING_TYPES.has(type)) return "border-green text-green";
  if (type === "adjustment") return "border-navy/30 text-navy/50";
  return "border-red text-red";
}

/** A ledger row, not a document card — DESKTOP's own Stock Ledger has no per-row detail view either
 * (a flat table), same precedent as TransactionRow.tsx. */
export function StockMovementRow({ movement }: { movement: StockMovementRowType }) {
  const tone = movementTone(movement.movementType);
  const changeTone = movement.movementType === "adjustment" ? "text-navy" : movement.quantityChange > 0 ? "text-green" : "text-red";

  return (
    <div className="flex w-full items-start gap-3 rounded-lg bg-white p-4 shadow-sm">
      <div className={`grid size-11 flex-none place-items-center rounded-full border-2 border-dashed ${tone} bg-cream-dark/60`}>
        <Package className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-bold text-navy">{movement.productName}</p>
          <p className={`flex-none font-display text-sm ${changeTone}`}>
            {movement.quantityChange > 0 ? "+" : ""}
            {movement.quantityChange}
          </p>
        </div>
        <p className="truncate text-xs text-navy/50">
          {movement.sku} ·{" "}
          {new Date(movement.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-bold text-blue">
          <Store className="size-3.5 flex-none" aria-hidden="true" />
          {movement.locationName}
        </p>
        <p className="mt-0.5 truncate text-xs text-navy/50">
          {formatCents(movement.valueCents, movement.currency)} value
          {movement.notes ? ` · ${movement.notes}` : ""}
        </p>
      </div>
      <span className={`flex-none rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${tone}`}>
        {STOCK_MOVEMENT_TYPE_LABELS[movement.movementType]}
      </span>
    </div>
  );
}
