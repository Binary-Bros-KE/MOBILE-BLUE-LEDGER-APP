// Minimal service worker: just enough for "Add to Home Screen" installability on both Chrome/
// Android (which requires a registered SW with a fetch handler) and iOS/Safari (which doesn't
// strictly need one, but tolerates it fine). No offline data caching — this app is a live
// financial dashboard, not an offline-first one, so a network-first passthrough is exactly right:
// never serve stale numbers when a real connection is available.
const SHELL_CACHE = "owner-app-shell-v1";
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached ?? Response.error())),
  );
});
