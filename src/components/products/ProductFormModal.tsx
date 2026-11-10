"use client";

import { useEffect, useState } from "react";
import { type PackRow, UnitsSetup, type UnitsKind } from "./UnitsSetup";
import { MEASURE_FAMILIES, priceConversionRatio, type ProductUnitConfig, unitFactor } from "@/lib/product-units";
import { ChevronDown, Loader2, Plus, ScanLine } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { centsToPriceText, priceTextToCents, priceTextToExactCents } from "@/lib/money";
import type { MobileCategory, ProductInput, ProductTaxTypeValue } from "@/lib/types";
import { BarcodeScannerSheet, cameraScanSupported } from "../BarcodeScannerSheet";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { hasSingleStorefront, type ProductManageOptions, stockLocations, storefrontLocations, UNIT_OF_MEASURE_OPTIONS } from "./manage-options";

type TaxMode = "inherit" | "inclusive" | "exclusive";

type FormState = {
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  storefrontId: string;
  unitOfMeasure: string;
  description: string;
  sellingPrice: string;
  buyingPrice: string;
  wholesalePrice: string;
  wholesaleMinQuantity: string;
  minimumPrice: string;
  taxType: ProductTaxTypeValue;
  taxMode: TaxMode;
  reorderLevel: string;
  trackStock: boolean;
  allowNegativeStock: boolean;
  openingLocationId: string;
  openingQuantity: string;
};

/** Where stock goes without asking: the viewer's assigned location, else the only stock location. */
function openingStockLocation(options: ProductManageOptions): string | null {
  const locations = stockLocations(options);
  if (options.workingLocationId && locations.some((l) => l.id === options.workingLocationId)) return options.workingLocationId;
  return locations.length === 1 ? locations[0]!.id : null;
}

/** "" = All Storefronts (storefrontId null) — same sentinel the Employees branch picker uses. */
const ALL_STOREFRONTS = "";

function emptyForm(options: ProductManageOptions): FormState {
  // Opening stock goes to the viewer's own location, or the only place stock can go — no picker.
  const fixedStockLocation = openingStockLocation(options);
  return {
    name: "",
    sku: "",
    barcode: "",
    categoryId: "",
    storefrontId: hasSingleStorefront(options) ? ALL_STOREFRONTS : (options.branchScope ?? ALL_STOREFRONTS),
    unitOfMeasure: "piece",
    description: "",
    sellingPrice: "",
    buyingPrice: "",
    wholesalePrice: "",
    wholesaleMinQuantity: "",
    minimumPrice: "",
    taxType: "vat",
    taxMode: "inherit",
    reorderLevel: "",
    trackStock: true,
    allowNegativeStock: false,
    openingLocationId: fixedStockLocation ?? options.branchScope ?? "",
    openingQuantity: "",
  };
}

/**
 * Add or edit a product — the day-to-day subset of DESKTOP's own Product form. Everything that sells
 * (name, prices, tax, stock settings) is here; online-store content, variants, images and brand stay
 * on DESKTOP, and an edit from here never touches them (SERVER only writes the fields this form
 * sends). SKU can be left blank on create — SERVER mints one in the same device-tagged scheme
 * DESKTOP uses ("PROD-M3-000012"), so it can never collide with a desktop-minted SKU.
 *
 * `productId` null = create (with optional opening stock at one location); set = edit, which loads
 * the product's current values first.
 */
export function ProductFormModal({
  productId,
  options,
  initialName,
  onClose,
  onSaved,
  onCategoryCreated,
}: {
  productId: string | null;
  options: ProductManageOptions;
  /** Pre-fills Name on a NEW product — e.g. a requisition's free-text item becoming a real product. */
  initialName?: string;
  onClose: () => void;
  /** `createdId` is set when a new product was created (absent on edit). */
  onSaved: (createdId?: string) => void;
  onCategoryCreated: (category: MobileCategory) => void;
}) {
  const isEdit = productId !== null;
  const [form, setForm] = useState<FormState>(() => ({ ...emptyForm(options), ...(initialName ? { name: initialName } : {}) }));
  const [loading, setLoading] = useState(isEdit);
  const [hasVariants, setHasVariants] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState<string | null>(null);
  const [unitsKind, setUnitsKind] = useState<UnitsKind>("");
  const [packRows, setPackRows] = useState<PackRow[]>([]);
  const [packDefaultUnit, setPackDefaultUnit] = useState<string | null>(null);
  const [conversionNotice, setConversionNotice] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const singleStorefront = hasSingleStorefront(options);

  useEffect(() => {
    if (!productId) return;
    api
      .getProductEditData(productId)
      .then((p) => {
        setHasVariants(p.hasVariants);
        // Everything in the form reads per the price unit (per kg), so scale the stored per-base values.
        const loadedConfig = p.unitConfig;
        const factor = unitFactor(loadedConfig, loadedConfig?.priceUnit);
        const inPriceUnit = (cents: number | null) => (cents === null ? null : Math.round(cents * factor));
        const countInPriceUnit = (count: number) => (count > 0 ? String(Math.round((count / factor) * 1000) / 1000) : "");
        if (loadedConfig?.kind === "pack") {
          setUnitsKind("pack");
          setPackDefaultUnit(loadedConfig.defaultSaleUnit);
          setPackRows(loadedConfig.units.map((u) => ({ code: u.code, factor: String(u.factor), price: centsToPriceText(u.priceCents) })));
        } else if (loadedConfig?.kind === "measure") {
          setUnitsKind(MEASURE_FAMILIES.find((f) => f.base === p.unitOfMeasure)?.key ?? "");
        }
        setForm({
          name: p.name,
          sku: p.sku,
          barcode: p.barcode ?? "",
          categoryId: p.categoryId ?? "",
          storefrontId: singleStorefront ? ALL_STOREFRONTS : (p.storefrontId ?? ALL_STOREFRONTS),
          unitOfMeasure: p.unitOfMeasure ?? "",
          description: p.description ?? "",
          sellingPrice: centsToPriceText(inPriceUnit(p.sellingPriceCents)),
          buyingPrice: centsToPriceText(inPriceUnit(p.buyingPriceCents)),
          wholesalePrice: centsToPriceText(inPriceUnit(p.wholesalePriceCents)),
          wholesaleMinQuantity: countInPriceUnit(p.wholesaleMinQuantity),
          minimumPrice: centsToPriceText(inPriceUnit(p.minimumPriceCents)),
          taxType: (["vat", "exempted", "zero_rated"].includes(p.taxType) ? p.taxType : "vat") as ProductTaxTypeValue,
          taxMode: p.pricesTaxInclusive === null ? "inherit" : p.pricesTaxInclusive ? "inclusive" : "exclusive",
          reorderLevel: countInPriceUnit(p.reorderLevel),
          trackStock: p.trackStock,
          allowNegativeStock: p.allowNegativeStock,
          openingLocationId: "",
          openingQuantity: "",
        });
        // Open the extra section straight away if anything in it is already set.
        setShowMore(p.wholesalePriceCents !== null || p.minimumPriceCents !== null || p.pricesTaxInclusive !== null || p.allowNegativeStock);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this product."))
      .finally(() => setLoading(false));
  }, [productId, singleStorefront]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateCategory(): Promise<void> {
    const name = newCategoryName?.trim();
    if (!name) return;
    try {
      const category = await api.createCategory(name);
      onCategoryCreated(category);
      set("categoryId", category.id);
      setNewCategoryName(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create category.");
    }
  }

  /** The unit the form's prices currently read in: the measure's larger unit, else the product's own. */
  function priceUnitOf(kind: UnitsKind, baseUnit: string): string | null {
    return MEASURE_FAMILIES.find((f) => f.key === kind)?.units[0]?.code ?? (baseUnit || null);
  }

  /** Switching how a product is sold re-expresses what's typed so it means the same: KES 0.26 per mL
   * becomes KES 260 per L, and says so, so the owner can check it before saving. */
  function changeUnitsKind(next: UnitsKind): void {
    const family = MEASURE_FAMILIES.find((f) => f.key === next);
    const nextBase = family ? family.base : form.unitOfMeasure;
    const fromUnit = priceUnitOf(unitsKind, form.unitOfMeasure);
    const toUnit = priceUnitOf(next, nextBase);
    const ratio = priceConversionRatio(fromUnit, toUnit);
    const scalePrice = (text: string) => {
      const cents = priceTextToExactCents(text);
      return cents === null || !text.trim() ? text : centsToPriceText(Math.round(cents * ratio));
    };
    const scaleCount = (text: string) => {
      const count = Number.parseFloat(text);
      return Number.isFinite(count) ? String(Math.round((count / ratio) * 1000) / 1000) : text;
    };
    if (ratio !== 1 && form.sellingPrice.trim()) {
      setConversionNotice(`Price converted: ${form.sellingPrice} per ${fromUnit} is ${scalePrice(form.sellingPrice)} per ${toUnit}. Check it before saving.`);
    } else {
      setConversionNotice(null);
    }
    setUnitsKind(next);
    if (next === "pack" && packRows.length === 0) setPackRows([{ code: "", factor: "", price: "" }]);
    setForm((prev) => ({
      ...prev,
      unitOfMeasure: nextBase,
      sellingPrice: scalePrice(prev.sellingPrice),
      buyingPrice: scalePrice(prev.buyingPrice),
      wholesalePrice: scalePrice(prev.wholesalePrice),
      minimumPrice: scalePrice(prev.minimumPrice),
      reorderLevel: scaleCount(prev.reorderLevel),
      wholesaleMinQuantity: scaleCount(prev.wholesaleMinQuantity),
      openingQuantity: scaleCount(prev.openingQuantity),
    }));
  }

  /** What's in the form as a unit config; a string is what's wrong with it. */
  function buildUnitConfig(): ProductUnitConfig | null | string {
    const family = MEASURE_FAMILIES.find((f) => f.key === unitsKind);
    if (family) {
      const unit = family.units[0]!;
      return { kind: "measure", priceUnit: unit.code, defaultSaleUnit: unit.code, units: family.units.map((u) => ({ code: u.code, factor: u.factor, priceCents: null })) };
    }
    if (unitsKind !== "pack") return null;
    const rows = packRows.filter((row) => row.code.trim() || row.factor.trim() || row.price.trim());
    if (rows.length === 0) return "Add a pack size, or choose One unit only.";
    const units = [];
    for (const row of rows) {
      const factor = Number.parseInt(row.factor, 10);
      if (!row.code.trim()) return "Give each pack size a name.";
      if (!factor || factor < 2) return `Enter how many are in one ${row.code.trim()} (at least 2).`;
      units.push({ code: row.code.trim(), factor, priceCents: row.price.trim() ? priceTextToCents(row.price) : null });
    }
    const defaultSaleUnit = units.some((u) => u.code === packDefaultUnit) ? packDefaultUnit : null;
    return { kind: "pack", priceUnit: null, defaultSaleUnit, units };
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const unitConfig = buildUnitConfig();
    if (typeof unitConfig === "string") return setError(unitConfig);
    // The form reads per the price unit (per kg); SERVER keeps everything per base unit (per g).
    const priceFactor = unitFactor(unitConfig, unitConfig?.priceUnit);
    const toBaseCents = (text: string) => {
      const cents = priceTextToExactCents(text);
      return cents === null ? null : cents / priceFactor;
    };
    const toBaseCount = (text: string) => Math.round((Number.parseFloat(text) || 0) * priceFactor);
    const sellingPriceCents = toBaseCents(form.sellingPrice);
    if (sellingPriceCents === null) return setError("Enter a selling price.");
    const buyingPriceCents = toBaseCents(form.buyingPrice) ?? 0;
    const wholesalePriceCents = form.wholesalePrice.trim() ? toBaseCents(form.wholesalePrice) : null;
    const minimumPriceCents = form.minimumPrice.trim() ? toBaseCents(form.minimumPrice) : null;
    if (buyingPriceCents > sellingPriceCents) {
      return setError("Buying price can't be higher than the selling price — every sale would be a loss.");
    }
    if (minimumPriceCents !== null && minimumPriceCents > sellingPriceCents) {
      return setError("Minimum price can't be higher than the selling price.");
    }

    const body: ProductInput = {
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      barcode: form.barcode.trim() || null,
      categoryId: form.categoryId || null,
      storefrontId: form.storefrontId === ALL_STOREFRONTS ? null : form.storefrontId,
      unitOfMeasure: form.unitOfMeasure || null,
      unitConfig,
      description: form.description.trim() || null,
      buyingPriceCents,
      sellingPriceCents,
      wholesalePriceCents,
      wholesaleMinQuantity: toBaseCount(form.wholesaleMinQuantity),
      minimumPriceCents,
      taxType: form.taxType,
      pricesTaxInclusive: form.taxMode === "inherit" ? null : form.taxMode === "inclusive",
      reorderLevel: toBaseCount(form.reorderLevel),
      trackStock: form.trackStock,
      allowNegativeStock: form.allowNegativeStock,
    };

    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await api.updateProduct(productId, body);
        onSaved();
      } else {
        const openingQuantity = toBaseCount(form.openingQuantity);
        const created = await api.createProduct({
          ...body,
          openingStock: form.trackStock && openingQuantity > 0 && form.openingLocationId ? { locationId: form.openingLocationId, quantity: openingQuantity } : null,
        });
        onSaved(created.id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  // Labels and typing for the price unit ("per kg") and measured stock amounts ("1.5").
  const measuredFamily = MEASURE_FAMILIES.find((f) => f.key === unitsKind);
  const priceUnitLabel = measuredFamily ? ` (per ${measuredFamily.units[0]!.code})` : "";
  const countUnitLabel = measuredFamily ? ` (${measuredFamily.units[0]!.code})` : "";
  const countFilter = (text: string) => (measuredFamily ? text.replace(/[^\d.]/g, "") : text.replace(/\D/g, ""));
  const storefronts = storefrontLocations(options);
  const openingLocations = stockLocations(options);
  const openingLocationFixed = openingStockLocation(options) !== null;

  if (scannerOpen) {
    return (
      <BarcodeScannerSheet
        onDetected={(code) => {
          set("barcode", code);
          setScannerOpen(false);
        }}
        onClose={() => setScannerOpen(false)}
      />
    );
  }

  return (
    <BottomSheet title={isEdit ? "Edit Product" : "Add Product"} subtitle={isEdit ? form.sku : "Leave SKU blank to auto-number it."} onClose={onClose}>
      {loading ? (
        <p className="py-10 text-center text-sm text-navy/50">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <SheetError message={error} />
          {hasVariants && (
            <p className="rounded border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold-text">
              This product has variants — manage those from the desktop POS.
            </p>
          )}

          <SheetField label="Product name">
            <input autoFocus={!isEdit} value={form.name} onChange={(e) => set("name", e.target.value)} required className={sheetInputClass} />
          </SheetField>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label={`Selling price${priceUnitLabel}`}>
              <input inputMode="decimal" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} required className={sheetInputClass} />
            </SheetField>
            <SheetField label={`Buying price${priceUnitLabel}`}>
              <input inputMode="decimal" value={form.buyingPrice} onChange={(e) => set("buyingPrice", e.target.value)} placeholder="0" className={sheetInputClass} />
            </SheetField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label={isEdit ? "SKU" : "SKU (optional)"}>
              <input value={form.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} placeholder="Auto" className={sheetInputClass} />
            </SheetField>
            <SheetField label="Barcode (optional)">
              <div className="flex gap-1.5">
                <input inputMode="numeric" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} className={`min-w-0 ${sheetInputClass}`} />
                {cameraScanSupported() && (
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    aria-label="Scan the barcode"
                    className="mt-1 grid w-10 flex-none place-items-center rounded-lg border border-navy/15 text-navy/60"
                  >
                    <ScanLine className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </SheetField>
          </div>

          {newCategoryName === null ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SheetField label="Category">
                  <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={sheetInputClass}>
                    <option value="">No category</option>
                    {options.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </SheetField>
              </div>
              <button
                type="button"
                onClick={() => setNewCategoryName("")}
                aria-label="New category"
                className="grid size-[38px] flex-none place-items-center rounded-lg border border-navy/15 text-navy/60 hover:bg-cream-dark"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SheetField label="New category name">
                  <input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className={sheetInputClass} />
                </SheetField>
              </div>
              <button type="button" onClick={() => void handleCreateCategory()} className="h-[38px] rounded-lg bg-navy px-3 text-xs font-bold text-white">
                Add
              </button>
              <button type="button" onClick={() => setNewCategoryName(null)} className="h-[38px] rounded-lg px-2 text-xs font-bold text-navy/50">
                Cancel
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Unit">
              <select value={form.unitOfMeasure} onChange={(e) => set("unitOfMeasure", e.target.value)} disabled={measuredFamily !== undefined} className={sheetInputClass}>
                <option value="">—</option>
                {UNIT_OF_MEASURE_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </SheetField>
            <SheetField label="Tax">
              <select value={form.taxType} onChange={(e) => set("taxType", e.target.value as ProductTaxTypeValue)} className={sheetInputClass}>
                <option value="vat">VAT ({options.vatRatePercent}%)</option>
                <option value="exempted">Exempted</option>
                <option value="zero_rated">Zero-Rated</option>
              </select>
            </SheetField>
          </div>

          {!hasVariants && (
            <UnitsSetup
              kind={unitsKind}
              onKindChange={changeUnitsKind}
              packRows={packRows}
              onPackRowsChange={setPackRows}
              defaultSaleUnit={packDefaultUnit}
              onDefaultSaleUnitChange={setPackDefaultUnit}
              baseUnit={form.unitOfMeasure}
            />
          )}
          {conversionNotice && <p className="rounded border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold-text">{conversionNotice}</p>}

          <SheetField label="Sold at">
            <select
              value={form.storefrontId}
              onChange={(e) => set("storefrontId", e.target.value)}
              disabled={singleStorefront || options.branchScope !== null}
              className={sheetInputClass}
            >
              <option value={ALL_STOREFRONTS}>All Storefronts</option>
              {storefronts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.locationName}
                </option>
              ))}
            </select>
          </SheetField>

          <div className="grid grid-cols-2 items-end gap-3">
            <Toggle label="Track stock" checked={form.trackStock} onChange={(v) => set("trackStock", v)} />
            {form.trackStock && (
              <SheetField label={`Low-stock alert at${countUnitLabel}`}>
                <input inputMode={measuredFamily ? "decimal" : "numeric"} value={form.reorderLevel} onChange={(e) => set("reorderLevel", countFilter(e.target.value))} placeholder="0 = off" className={sheetInputClass} />
              </SheetField>
            )}
          </div>

          {!isEdit && form.trackStock && (
            <div className="grid grid-cols-2 gap-3">
              <SheetField label="Opening stock at">
                <select
                  value={form.openingLocationId}
                  onChange={(e) => set("openingLocationId", e.target.value)}
                  disabled={openingLocationFixed}
                  className={sheetInputClass}
                >
                  {!openingLocationFixed && <option value="">None</option>}
                  {openingLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.locationName}
                    </option>
                  ))}
                </select>
              </SheetField>
              <SheetField label={`Quantity${countUnitLabel}`}>
                <input
                  inputMode={measuredFamily ? "decimal" : "numeric"}
                  value={form.openingQuantity}
                  onChange={(e) => set("openingQuantity", countFilter(e.target.value))}
                  disabled={!form.openingLocationId}
                  className={sheetInputClass}
                />
              </SheetField>
            </div>
          )}

          <button type="button" onClick={() => setShowMore((v) => !v)} className="flex items-center gap-1 text-xs font-bold text-blue">
            <ChevronDown className={`size-3.5 transition ${showMore ? "rotate-180" : ""}`} aria-hidden="true" />
            More options
          </button>

          {showMore && (
            <div className="space-y-3 rounded-lg bg-cream-dark/50 p-3">
              <div className="grid grid-cols-2 gap-3">
                <SheetField label={`Wholesale price${priceUnitLabel}`}>
                  <input inputMode="decimal" value={form.wholesalePrice} onChange={(e) => set("wholesalePrice", e.target.value)} className={sheetInputClass} />
                </SheetField>
                <SheetField label={`From quantity${countUnitLabel}`}>
                  <input inputMode="numeric" value={form.wholesaleMinQuantity} onChange={(e) => set("wholesaleMinQuantity", countFilter(e.target.value))} className={sheetInputClass} />
                </SheetField>
              </div>
              <SheetField label={`Minimum selling price${priceUnitLabel} (discount floor)`}>
                <input inputMode="decimal" value={form.minimumPrice} onChange={(e) => set("minimumPrice", e.target.value)} placeholder="No floor" className={sheetInputClass} />
              </SheetField>
              <SheetField label="Price includes tax?">
                <select value={form.taxMode} onChange={(e) => set("taxMode", e.target.value as TaxMode)} className={sheetInputClass}>
                  <option value="inherit">Use business default</option>
                  <option value="inclusive">Inclusive of tax</option>
                  <option value="exclusive">Exclusive of tax</option>
                </select>
              </SheetField>
              {form.trackStock && <Toggle label="Allow selling below zero stock" checked={form.allowNegativeStock} onChange={(v) => set("allowNegativeStock", v)} />}
              <SheetField label="Description">
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className={sheetInputClass} />
              </SheetField>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Product"}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-[38px] cursor-pointer items-center gap-2 text-sm font-semibold text-navy">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-blue" />
      {label}
    </label>
  );
}
