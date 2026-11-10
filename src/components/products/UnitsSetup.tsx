"use client";

import { Plus, Trash2 } from "lucide-react";
import { MEASURE_FAMILIES } from "@/lib/product-units";
import { SheetField, sheetInputClass } from "../BottomSheet";

/** "" = one unit only; a measure family key (weight, volume, length); or "pack". */
export type UnitsKind = string;

export type PackRow = { code: string; factor: string; price: string };

/**
 * "Sold as" in the product form — how a product can be sold in more than one unit. A measure (rice by
 * kg or g) fixes the counting unit to the family's smallest, so stock stays whole numbers. A pack
 * (carton = 24 pieces) keeps the product's own unit and can carry its own price.
 */
export function UnitsSetup({
  kind,
  onKindChange,
  packRows,
  onPackRowsChange,
  defaultSaleUnit,
  onDefaultSaleUnitChange,
  baseUnit,
}: {
  kind: UnitsKind;
  onKindChange: (kind: UnitsKind) => void;
  packRows: PackRow[];
  onPackRowsChange: (rows: PackRow[]) => void;
  defaultSaleUnit: string | null;
  onDefaultSaleUnitChange: (code: string | null) => void;
  baseUnit: string;
}) {
  const family = MEASURE_FAMILIES.find((f) => f.key === kind);

  function updateRow(index: number, patch: Partial<PackRow>): void {
    onPackRowsChange(packRows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const namedRows = packRows.filter((row) => row.code.trim());

  return (
    <div className="space-y-2">
      <SheetField label="Sold as">
        <select value={kind} onChange={(e) => onKindChange(e.target.value)} className={sheetInputClass}>
          <option value="">One unit only</option>
          {MEASURE_FAMILIES.map((f) => (
            <option key={f.key} value={f.key}>
              By {f.label.toLowerCase()} ({[...f.units.map((u) => u.code), f.base].join(", ")})
            </option>
          ))}
          <option value="pack">In packs (carton, crate…)</option>
        </select>
      </SheetField>

      {family && (
        <p className="rounded-lg bg-cream-dark/60 px-3 py-2 text-[11px] text-navy/70">
          Prices are per {family.units[0]!.code}. Stock shows as {family.units[0]!.code} and {family.base}, and sales can be in either.
        </p>
      )}

      {kind === "pack" && (
        <div className="space-y-2 rounded-lg bg-cream-dark/50 p-3">
          {packRows.map((row, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,3fr)_auto] items-end gap-2">
              <SheetField label="Pack name">
                <input value={row.code} onChange={(e) => updateRow(index, { code: e.target.value })} placeholder="carton" className={sheetInputClass} />
              </SheetField>
              <SheetField label={`${baseUnit || "Pieces"} in it`}>
                <input inputMode="numeric" value={row.factor} onChange={(e) => updateRow(index, { factor: e.target.value.replace(/\D/g, "") })} placeholder="24" className={sheetInputClass} />
              </SheetField>
              <SheetField label="Own price">
                <input inputMode="decimal" value={row.price} onChange={(e) => updateRow(index, { price: e.target.value })} placeholder="Optional" className={sheetInputClass} />
              </SheetField>
              <button
                type="button"
                onClick={() => onPackRowsChange(packRows.filter((_, i) => i !== index))}
                aria-label="Remove this pack"
                className="grid size-[38px] flex-none place-items-center text-navy/30 hover:text-red"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          {packRows.length < 3 && (
            <button type="button" onClick={() => onPackRowsChange([...packRows, { code: "", factor: "", price: "" }])} className="flex items-center gap-1 text-xs font-bold text-blue">
              <Plus className="size-3.5" aria-hidden="true" />
              Add a pack size
            </button>
          )}
          {namedRows.length > 0 && (
            <SheetField label="Usually sold as">
              <select value={defaultSaleUnit ?? ""} onChange={(e) => onDefaultSaleUnitChange(e.target.value || null)} className={sheetInputClass}>
                <option value="">{baseUnit || "Single unit"}</option>
                {namedRows.map((row) => (
                  <option key={row.code} value={row.code.trim()}>
                    {row.code.trim()}
                  </option>
                ))}
              </select>
            </SheetField>
          )}
          <p className="text-[11px] text-navy/50">Leave the price empty to charge the pack at its pieces&apos; total.</p>
        </div>
      )}
    </div>
  );
}
