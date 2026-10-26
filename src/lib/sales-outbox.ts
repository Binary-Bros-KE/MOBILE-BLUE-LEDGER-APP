import { api, ApiError, isOfflineError } from "./api";
import type { CheckoutRequest } from "./types";

/**
 * Sales completed while the phone was offline, waiting to reach SERVER — stored on the phone and
 * sent in the order they happened as soon as there's a connection. Each keeps the checkout's own
 * client-minted id, so a send that times out after SERVER already saved it is a safe no-op when
 * retried (mobile-checkout-service.ts's idempotency), never a second sale.
 *
 *  - "pending": not sent yet (or the send couldn't reach SERVER) — retried automatically.
 *  - "failed": SERVER refused it (e.g. a product was deleted meanwhile). It stays here, visible, until
 *    someone fixes the cause and retries, or discards it — money was already taken for it, so it is
 *    never dropped silently.
 */

export type QueuedSale = {
  id: string;
  request: CheckoutRequest;
  queuedAt: string;
  /** For the list — the receipt number only exists once SERVER accepts it. */
  label: string;
  totalCents: number;
  status: "pending" | "failed";
  error: string | null;
};

export type SyncedSale = { id: string; receiptNumber: string; label: string; stockShortfalls: string[] };

const STORAGE_KEY = "bl_sales_outbox";
const CHANGE_EVENT = "bl-outbox-changed";

function readAll(): QueuedSale[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedSale[]) : [];
  } catch {
    return [];
  }
}

function writeAll(sales: QueuedSale[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
  } catch {
    // If even this fails the sale can't be kept — callers check enqueueSale's return value.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function listQueuedSales(): QueuedSale[] {
  return readAll();
}

/** Returns false if the phone couldn't store it (storage blocked/full) — the caller must then tell
 * the cashier the sale was NOT saved. */
export function enqueueSale(request: CheckoutRequest, meta: { label: string; totalCents: number }): boolean {
  const all = readAll();
  if (all.some((s) => s.id === request.id)) return true;
  const next: QueuedSale[] = [...all, { id: request.id, request, queuedAt: new Date().toISOString(), label: meta.label, totalCents: meta.totalCents, status: "pending", error: null }];
  writeAll(next);
  return readAll().some((s) => s.id === request.id);
}

export function discardQueuedSale(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}

/** Puts a failed sale back to pending so the next sync tries it again. */
export function retryQueuedSale(id: string): void {
  writeAll(readAll().map((s) => (s.id === id ? { ...s, status: "pending", error: null } : s)));
}

export function onOutboxChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  // Another tab of the installed web app syncing the same outbox.
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

let flushing: Promise<SyncedSale[]> | null = null;

/** Sends every pending sale, oldest first. Stops at the first one that can't reach SERVER (still
 * offline) so order is kept; a sale SERVER refuses is marked failed and the rest carry on. Only one
 * flush runs at a time. Returns what was accepted (receipt numbers + any stock shortfalls). */
export function flushOutbox(): Promise<SyncedSale[]> {
  if (!flushing) {
    flushing = (async () => {
      const synced: SyncedSale[] = [];
      for (const sale of readAll().filter((s) => s.status === "pending")) {
        try {
          const result = await api.checkout(sale.request);
          synced.push({ id: sale.id, receiptNumber: result.receiptNumber, label: sale.label, stockShortfalls: result.stockShortfalls ?? [] });
          writeAll(readAll().filter((s) => s.id !== sale.id));
        } catch (err) {
          if (isOfflineError(err) || (err instanceof ApiError && (err.status >= 500 || err.status === 401))) break;
          const message = err instanceof ApiError ? err.message : "Couldn't be saved";
          writeAll(readAll().map((s) => (s.id === sale.id ? { ...s, status: "failed", error: message } : s)));
        }
      }
      return synced;
    })().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}
