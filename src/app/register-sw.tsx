"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a nice-to-have, not load-bearing — a failed registration (e.g. running
        // over plain http in dev) should never block the app from working.
      });
    }
  }, []);

  return null;
}
