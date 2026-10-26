/** Last-known copies of what the till needs to keep selling without a connection — the product
 * catalogue, payment methods, customers, riders, suppliers, storefronts and the signed-in session.
 * Written after every successful load, read only when a load fails because the phone is offline.
 * Per phone and per signed-in license (keys are cleared on logout with the session token), never a
 * source of truth: SERVER re-validates every queued sale when it finally arrives. */

const PREFIX = "bl_cache_";

export type OfflineCacheKey = "products" | "paymentMethods" | "customers" | "riders" | "suppliers" | "storefronts" | "me";

export function saveOfflineCache<T>(key: OfflineCacheKey, data: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: new Date().toISOString(), data }));
  } catch {
    // Storage full or blocked — offline mode just won't have this list; nothing else breaks.
  }
}

export function loadOfflineCache<T>(key: OfflineCacheKey): { data: T; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as { data: T; savedAt: string }) : null;
  } catch {
    return null;
  }
}

export function clearOfflineCache(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Nothing to clear.
  }
}

/** Loads fresh data and caches it; if the phone is offline, falls back to the last cached copy
 * (`fromCache` tells the caller to say so). Any other failure (401, 500…) is rethrown unchanged. */
export async function loadWithOfflineFallback<T>(key: OfflineCacheKey, load: () => Promise<T>, isOffline: (err: unknown) => boolean): Promise<{ data: T; fromCache: boolean }> {
  try {
    const data = await load();
    saveOfflineCache(key, data);
    return { data, fromCache: false };
  } catch (err) {
    const cached = isOffline(err) ? loadOfflineCache<T>(key) : null;
    if (cached) return { data: cached.data, fromCache: true };
    throw err;
  }
}
