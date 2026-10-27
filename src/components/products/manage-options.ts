import type { MobileCategory, MobileLocation } from "@/lib/types";

/** What the product forms and stock sheet need for their pickers — loaded once by ProductsTab.
 * `branchScope` is the viewer's own storefront when they're branch-scoped (non-Super-Admin with a
 * branch) — same rule SERVER's mobile-products-service.ts enforces. */
export type ProductManageOptions = {
  categories: MobileCategory[];
  /** Every location, with locationType ("distribution_center" = Main Store). */
  locations: MobileLocation[];
  branchScope: string | null;
  /** The viewer's assigned location (session.branchId), Super Admins included — where they work.
   * Like Checkout, anything done "at a location" (opening stock, stock adjustments) uses it without
   * asking. Unlike branchScope it grants/limits nothing on SERVER. */
  workingLocationId: string | null;
  vatRatePercent: number;
};

export const MAIN_STORE_TYPE = "distribution_center";

/** Mirrors DESKTOP's isStorefrontType — the Main Store/warehouse never sells directly. */
export function storefrontLocations(options: ProductManageOptions): MobileLocation[] {
  return options.locations.filter((l) => l.locationType !== MAIN_STORE_TYPE && l.locationType !== "warehouse");
}

/** One storefront (or none) — "Sold at" is then fixed to All Storefronts; SERVER enforces the same. */
export function hasSingleStorefront(options: ProductManageOptions): boolean {
  return storefrontLocations(options).length <= 1;
}

/** Where this viewer may change stock: their own storefront + the Main Store when branch-scoped
 * (DESKTOP's assertOpeningStockLocationsAllowed), everywhere otherwise. */
export function stockLocations(options: ProductManageOptions): MobileLocation[] {
  if (!options.branchScope) return options.locations;
  return options.locations.filter((l) => l.id === options.branchScope || l.locationType === MAIN_STORE_TYPE);
}

/** Mirrors DESKTOP's UNIT_OF_MEASURE_OPTIONS (shared/types/product.ts). */
export const UNIT_OF_MEASURE_OPTIONS = [
  { value: "piece", label: "Piece" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
  { value: "carton", label: "Carton" },
  { value: "set", label: "Set" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "L", label: "Litre (L)" },
  { value: "mL", label: "Millilitre (mL)" },
  { value: "m", label: "Metre (m)" },
  { value: "cm", label: "Centimetre (cm)" },
  { value: "dozen", label: "Dozen" },
  { value: "pair", label: "Pair" },
  { value: "roll", label: "Roll" },
  { value: "bottle", label: "Bottle" },
  { value: "can", label: "Can" },
  { value: "bag", label: "Bag" },
  { value: "sack", label: "Sack" },
  { value: "bundle", label: "Bundle" },
  { value: "tray", label: "Tray" },
  { value: "tube", label: "Tube" },
  { value: "jar", label: "Jar" },
  { value: "bucket", label: "Bucket" },
  { value: "plate", label: "Plate" },
  { value: "sheet", label: "Sheet" },
] as const;

/** Measures written as a symbol — never pluralised ("2.5 Kg", "3 L"). */
const UNIT_SYMBOLS: Record<string, string> = { kg: "Kg", g: "g", L: "L", mL: "mL", m: "m", cm: "cm" };

/** "11 Pieces", "1 Box", "2.5 Kg" — a quantity in the product's unit of measure ("Units" when unset). */
export function formatQuantityWithUnit(quantity: number, unitOfMeasure: string | null): string {
  const symbol = unitOfMeasure ? UNIT_SYMBOLS[unitOfMeasure] : undefined;
  if (symbol) return `${quantity} ${symbol}`;
  const word = unitOfMeasure ? unitOfMeasure.charAt(0).toUpperCase() + unitOfMeasure.slice(1) : "Unit";
  if (quantity === 1 || word === "Dozen") return `${quantity} ${word}`;
  return `${quantity} ${/(x|s|ch|sh)$/.test(word) ? `${word}es` : `${word}s`}`;
}
