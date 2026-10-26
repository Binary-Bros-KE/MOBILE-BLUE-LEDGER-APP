# Blue Ledger POS — Android app

The Android app is a Capacitor shell around the **hosted** Owner App, plus one native feature:
Bluetooth receipt printing. Why hosted and not bundled: see `capacitor.config.ts`.

## What you need (once)

- Android Studio (it brings the JDK and Android SDK).
- The production Owner App URL (https), e.g. `https://app.example.com`.

## Build

```bash
cd APP
npm install

# Bakes the URL into the Android project — run again whenever the URL or capacitor.config.ts changes.
# PowerShell:  $env:BL_APP_URL="https://your-owner-app-url"; npx cap sync android
BL_APP_URL=https://your-owner-app-url npx cap sync android

npx cap open android   # opens Android Studio
```

In Android Studio: **Build → Generate Signed App Bundle / APK**. Keep the signing key safe —
every later update must be signed with the same key.

Web changes (everything under `src/`) need **no new APK**: deploy the web app as usual and every
phone picks it up on its next launch. Rebuild the APK only when `android/` or
`capacitor.config.ts` changes.

## Receipt printer (per phone)

1. Switch on the 58mm/80mm Bluetooth thermal printer and pair it in the phone's Bluetooth settings
   (PIN is usually `0000` or `1234`).
2. In the app, open any receipt → **Print** → choose the printer, paper width and whether every
   sale prints automatically → **Test print** → **Save**.

Only already-paired printers are listed, so no location permission is needed. On Android 12+ the
app asks for "Nearby devices" the first time.

## Offline

After the first launch the app opens without internet (service worker cache). Checkout keeps
selling from the phone's saved product list; sales made offline are kept on the phone and sent
automatically when the connection returns (see the bar under the header). Putting a sale on
account and M-Pesa prompts need a connection.
