// Service worker: "Add to Home Screen" installability on Chrome/Android (needs a registered SW with a
// fetch handler) and iOS/Safari, plus just enough caching for the app to OPEN with no connection so
// the till can keep selling offline (Checkout falls back to its own saved product list and queues
// sales — see src/lib/offline-cache.ts and src/lib/sales-outbox.ts). Live data is never served stale
// from here: API requests go to another origin and are never intercepted — the app itself decides
// when a saved copy is good enough.
const SHELL_CACHE = "owner-app-shell-v2";
const SHELL_ASSETS = ["/", "/manifest.json", "/BLUE_LEDGER.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

function putInCache(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // API calls (another origin) are left alone — never cached, never answered from here.
  if (url.origin !== self.location.origin) return;

  // Build output is content-hashed and immutable: cache-first, saved the first time it's fetched.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((res) => putInCache(request, res))));
    return;
  }

  // Pages: always try the network (never stale when online); offline, the last copy of that page —
  // or the app shell — so the app still opens.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => putInCache(request, res))
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/")).then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // Everything else of ours (icons, manifest): network-first, cached copy when offline.
  event.respondWith(
    fetch(request)
      .then((res) => putInCache(request, res))
      .catch(() => caches.match(request).then((cached) => cached ?? Response.error())),
  );
});
