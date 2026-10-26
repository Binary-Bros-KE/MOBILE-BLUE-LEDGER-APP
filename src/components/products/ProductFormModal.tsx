"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { centsToPriceText, priceTextToCents } from "@/lib/money";
import type { MobileCategory, ProductInput, ProductTaxTypeValue } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { type ProductManageOptions, stockLocations, storefrontLocations, UNIT_OF_MEASURE_OPTIONS } from "./manage-options";

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

/** "" = All Storefronts (storefrontId null) — same sentinel the Employees branch picker uses. */
const ALL_STOREFRONTS = "";

function emptyForm(options: ProductManageOptions): FormState {
  return {
    name: "",
    sku: "",
    barcode: "",
    categoryId: "",
    storefrontId: options.branchScope ?? ALL_STOREFRONTS,
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
    openingLocationId: options.branchScope ?? "",
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
  onClose,
  onSaved,
  onCategoryCreated,
}: {
  productId: string | null;
  options: ProductManageOptions;
  onClose: () => void;
  onSaved: () => void;
  onCategoryCreated: (category: MobileCategory) => void;
}) {
  const isEdit = productId !== null;
  const [form, setForm] = useState<FormState>(() => emptyForm(options));
  const [loading, setLoading] = useState(isEdit);
  const [hasVariants, setHasVariants] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    api
      .getProductEditData(productId)
      .then((p) => {
        setHasVariants(p.hasVariants);
        setForm({
          name: p.name,
          sku: p.sku,
          barcode: p.barcode ?? "",
          categoryId: p.categoryId ?? "",
          storefrontId: p.storefrontId ?? ALL_STOREFRONTS,
          unitOfMeasure: p.unitOfMeasure ?? "",
          description: p.description ?? "",
          sellingPrice: centsToPriceText(p.sellingPriceCents),
          buyingPrice: centsToPriceText(p.buyingPriceCents),
          wholesalePrice: centsToPriceText(p.wholesalePriceCents),
          wholesaleMinQuantity: p.wholesaleMinQuantity > 0 ? String(p.wholesaleMinQuantity) : "",
          minimumPrice: centsToPriceText(p.minimumPriceCents),
          taxType: (["vat", "exempted", "zero_rated"].includes(p.taxType) ? p.taxType : "vat") as ProductTaxTypeValue,
          taxMode: p.pricesTaxInclusive === null ? "inherit" : p.pricesTaxInclusive ? "inclusive" : "exclusive",
          reorderLevel: p.reorderLevel > 0 ? String(p.reorderLevel) : "",
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
  }, [productId]);

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

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const sellingPriceCents = priceTextToCents(form.sellingPrice);
    if (sellingPriceCents === null) return setError("Enter a selling price.");
    const buyingPriceCents = priceTextToCents(form.buyingPrice) ?? 0;
    const wholesalePriceCents = form.wholesalePrice.trim() ? priceTextToCents(form.wholesalePrice) : null;
    const minimumPriceCents = form.minimumPrice.trim() ? priceTextToCents(form.minimumPrice) : null;
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
      description: form.description.trim() || null,
      buyingPriceCents,
      sellingPriceCents,
      wholesalePriceCents,
      wholesaleMinQuantity: Number.parseInt(form.wholesaleMinQuantity, 10) || 0,
      minimumPriceCents,
      taxType: form.taxType,
      pricesTaxInclusive: form.taxMode === "inherit" ? null : form.taxMode === "inclusive",
      reorderLevel: Number.parseInt(form.reorderLevel, 10) || 0,
      trackStock: form.trackStock,
      allowNegativeStock: form.allowNegativeStock,
    };

    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await api.updateProduct(productId, body);
      } else {
        const openingQuantity = Number.parseInt(form.openingQuantity, 10) || 0;
        await api.createProduct({
          ...body,
          openingStock: form.trackStock && openingQuantity > 0 && form.openingLocationId ? { locationId: form.openingLocationId, quantity: openingQuantity } : null,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  const storefronts = storefrontLocations(options);
  const openingLocations = stockLocations(options);

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
            <SheetField label="Selling price">
              <input inputMode="decimal" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} required className={sheetInputClass} />
            </SheetField>
            <SheetField label="Buying price">
              <input inputMode="decimal" value={form.buyingPrice} onChange={(e) => set("buyingPrice", e.target.value)} placeholder="0" className={sheetInputClass} />
            </SheetField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label={isEdit ? "SKU" : "SKU (optional)"}>
              <input value={form.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} placeholder="Auto" className={sheetInputClass} />
            </SheetField>
            <SheetField label="Barcode (optional)">
              <input inputMode="numeric" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} className={sheetInputClass} />
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
              <select value={form.unitOfMeasure} onChange={(e) => set("unitOfMeasure", e.target.value)} className={sheetInputClass}>
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

          <SheetField label="Sold at">
            <select
              value={form.storefrontId}
              onChange={(e) => set("storefrontId", e.target.value)}
              disabled={options.branchScope !== null}
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
              <SheetField label="Low-stock alert at">
                <input inputMode="numeric" value={form.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value.replace(/\D/g, ""))} placeholder="0 = off" className={sheetInputClass} />
              </SheetField>
            )}
          </div>

          {!isEdit && form.trackStock && (
            <div className="grid grid-cols-2 gap-3">
              <SheetField label="Opening stock at">
                <select value={form.openingLocationId} onChange={(e) => set("openingLocationId", e.target.value)} className={sheetInputClass}>
                  <option value="">None</option>
                  {openingLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.locationName}
                    </option>
                  ))}
                </select>
              </SheetField>
              <SheetField label="Quantity">
                <input
                  inputMode="numeric"
                  value={form.openingQuantity}
                  onChange={(e) => set("openingQuantity", e.target.value.replace(/\D/g, ""))}
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
                <SheetField label="Wholesale price">
                  <input inputMode="decimal" value={form.wholesalePrice} onChange={(e) => set("wholesalePrice", e.target.value)} className={sheetInputClass} />
                </SheetField>
                <SheetField label="From quantity">
                  <input inputMode="numeric" value={form.wholesaleMinQuantity} onChange={(e) => set("wholesaleMinQuantity", e.target.value.replace(/\D/g, ""))} className={sheetInputClass} />
                </SheetField>
              </div>
              <SheetField label="Minimum selling price (discount floor)">
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
