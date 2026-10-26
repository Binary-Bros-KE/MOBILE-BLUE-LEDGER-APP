import type { CheckoutCartLine, ServiceChargeDraft } from "./types";

/** A cart put aside mid-sale ("Park") to serve the next customer, resumed later from the same phone.
 * Device-local on purpose — DESKTOP's own held sales are local-only too (never synced; see its sync
 * engine's pending-sale exclusion), so a parked cart is never a half-sale the rest of the business
 * can see. Prices are only a preview here; SERVER re-prices everything when the sale is completed. */
export type ParkedSale = {
  id: string;
  /** The storefront it was parked at — a parked cart only resumes where it was started. */
  locationId: string;
  parkedAt: string;
  label: string;
  cart: CheckoutCartLine[];
  customerId: string | null;
  /** The checkout's own DeliveryDraft — kept opaque here so this module doesn't depend on a component. */
  delivery: unknown;
  serviceCharges: ServiceChargeDraft[];
  orderNotes: string;
};

const STORAGE_KEY = "bl_parked_sales";
/** Plenty for a busy counter; oldest drop off first so storage can't grow forever. */
const MAX_PARKED = 20;

function readAll(): ParkedSale[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ParkedSale[]) : [];
  } catch {
    return [];
  }
}

function writeAll(sales: ParkedSale[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sales.slice(-MAX_PARKED)));
  } catch {
    // Storage full or blocked (private mode) — parking just doesn't persist; nothing else breaks.
  }
}

export function listParkedSales(locationId: string): ParkedSale[] {
  return readAll()
    .filter((s) => s.locationId === locationId)
    .sort((a, b) => b.parkedAt.localeCompare(a.parkedAt));
}

export function parkSale(sale: Omit<ParkedSale, "id" | "parkedAt">): void {
  writeAll([...readAll(), { ...sale, id: crypto.randomUUID(), parkedAt: new Date().toISOString() }]);
}

/** Removes and returns it — resuming takes the cart back out of the parked list. */
export function takeParkedSale(id: string): ParkedSale | null {
  const all = readAll();
  const found = all.find((s) => s.id === id) ?? null;
  if (found) writeAll(all.filter((s) => s.id !== id));
  return found;
}

export function discardParkedSale(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}
