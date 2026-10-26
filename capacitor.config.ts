import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Android app is a native shell around the HOSTED Owner App (server.url), not a bundled copy:
 *  - Next.js' static export can't be served from Capacitor's local server — it answers every
 *    extension-less path (/login, /locked) with the root index.html, so hard navigations and reloads
 *    would land on the wrong page.
 *  - Every web deploy reaches every phone immediately, no Play Store release needed.
 *  - Offline still works: the service worker (public/sw.js) caches the app on first launch, and
 *    Checkout keeps selling from its offline caches/outbox.
 *  - Native features (Bluetooth receipt printing) are still available — Capacitor injects its bridge
 *    into server.url pages.
 *
 * BL_APP_URL must be the production Owner App address (https). `npx cap sync android` bakes it into
 * android/app/src/main/assets/capacitor.config.json, so set it before every sync.
 */
const appUrl = process.env.BL_APP_URL;
if (!appUrl || !appUrl.startsWith("https://")) {
  throw new Error("Set BL_APP_URL to the production Owner App https URL before running Capacitor (e.g. BL_APP_URL=https://… npx cap sync android).");
}

const config: CapacitorConfig = {
  appId: "app.blueledgerpos.pos",
  appName: "Blue Ledger POS",
  // Only shown if the hosted app can't be reached on the very first launch (before the service
  // worker has cached it).
  webDir: "capacitor-www",
  server: {
    url: appUrl,
    // The app must never fall back to plain http.
    cleartext: false,
    errorPath: "index.html",
  },
  android: {
    // Shop phones are often older — keep WebView debugging off in release builds.
    webContentsDebuggingEnabled: false,
  },
};

export default config;
