"use client";

import { useEffect, useState } from "react";
import { Bluetooth, Loader2, Printer, RefreshCw } from "lucide-react";
import {
  availableConnection,
  getPrinterSettings,
  isIos,
  listPairedPrinters,
  printerErrorMessage,
  printTestPage,
  savePrinterSettings,
  type PrinterSettings,
} from "@/lib/printer";
import { pairBluetoothPrinter } from "@/lib/web-bluetooth-printer";
import { BottomSheet, SheetError } from "./BottomSheet";

/**
 * Set up this phone's receipt printer — saved on this phone only. What it shows depends on how the
 * phone can print (lib/printer.ts availableConnection):
 *  - Web Bluetooth (Chrome on Android, Bluefy on iPhone): "Connect printer" opens the browser's own
 *    Bluetooth list once; after that printing reconnects by itself.
 *  - The Android app: the printers already paired in Android's Bluetooth settings.
 *  - No Bluetooth (iPhone Safari): the phone's print sheet, plus how to print straight to the
 *    printer with the Bluefy browser.
 * Paper width and "print every sale automatically" apply to all three.
 */
export function PrinterSetupSheet({ onClose, onSaved }: { onClose: () => void; onSaved: (settings: PrinterSettings) => void }) {
  const connection = availableConnection();
  const existing = getPrinterSettings();
  const sameConnection = existing?.connection === connection ? existing : null;
  const [devices, setDevices] = useState<Array<{ name: string; address: string }> | null>(null);
  const [printer, setPrinter] = useState<{ address: string; name: string } | null>(
    sameConnection && connection !== "browser" ? { address: sameConnection.address, name: sameConnection.name } : null,
  );
  const [paperWidth, setPaperWidth] = useState<58 | 80>(existing?.paperWidth ?? 58);
  const [autoPrint, setAutoPrint] = useState(existing?.autoPrint ?? true);
  const [busy, setBusy] = useState<"loading" | "connecting" | "testing" | null>(connection === "native" ? "loading" : null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function fetchDevices(): void {
    if (connection !== "native") return;
    listPairedPrinters()
      .then((found) => {
        setDevices(found);
        if (found.length === 1) setPrinter((current) => current ?? { address: found[0]!.address, name: found[0]!.name });
      })
      .catch((err) => setError(printerErrorMessage(err)))
      .finally(() => setBusy(null));
  }

  function loadDevices(): void {
    setBusy("loading");
    setError(null);
    fetchDevices();
  }

  // The Android app may prompt for Bluetooth permission the first time — only on open.
  useEffect(fetchDevices, [connection]);

  async function connectBluetooth(): Promise<void> {
    setBusy("connecting");
    setError(null);
    setNotice(null);
    try {
      const device = await pairBluetoothPrinter();
      setPrinter({ address: device.id, name: device.name });
      setNotice(`Connected to ${device.name}.`);
    } catch (err) {
      setError(printerErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function current(): PrinterSettings | null {
    if (connection === "browser") return { connection, address: "", name: "Phone print sheet", paperWidth, autoPrint };
    return printer ? { connection, address: printer.address, name: printer.name, paperWidth, autoPrint } : null;
  }

  async function testPrint(): Promise<void> {
    const settings = current();
    if (!settings) return setError("Connect a printer first.");
    setBusy("testing");
    setError(null);
    setNotice(null);
    try {
      await printTestPage(settings);
      if (connection !== "browser") setNotice("Test page sent — check the printer.");
    } catch (err) {
      setError(printerErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function save(): void {
    const settings = current();
    if (!settings) return setError("Connect a printer first.");
    savePrinterSettings(settings);
    onSaved(settings);
  }

  const ready = connection === "browser" || printer !== null;

  return (
    <BottomSheet title="Receipt Printer" subtitle="Saved on this phone only." onClose={onClose}>
      <div className="space-y-3">
        <SheetError message={error} />
        {notice && <p className="text-xs font-semibold text-green">{notice}</p>}

        {connection === "bluetooth" && (
          <>
            <p className="text-xs text-navy/60">
              Turn the printer on, then tap Connect and choose it from the list. You only do this once — after that, receipts print straight to it.
            </p>
            {printer && (
              <div className="flex items-center gap-2.5 rounded-lg border border-blue bg-blue/5 px-3 py-2.5">
                <Bluetooth className="size-4 flex-none text-blue" aria-hidden="true" />
                <span className="min-w-0 truncate text-sm font-bold text-navy">{printer.name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => void connectBluetooth()}
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue/30 bg-blue/5 py-3 text-sm font-bold text-blue disabled:opacity-50"
            >
              {busy === "connecting" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Bluetooth className="size-4" aria-hidden="true" />}
              {printer ? "Connect a different printer" : "Connect printer"}
            </button>
          </>
        )}

        {connection === "native" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-navy/50">Paired Bluetooth devices</p>
              <button type="button" onClick={loadDevices} className="flex items-center gap-1 text-[11px] font-bold text-blue">
                <RefreshCw className={`size-3 ${busy === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />
                Refresh
              </button>
            </div>
            {devices && devices.length === 0 && (
              <p className="rounded-lg bg-cream-dark/60 px-3 py-2.5 text-xs text-navy/70">
                No paired devices. Turn the printer on, pair it in your phone&apos;s Bluetooth settings (PIN is usually 0000 or 1234), then tap Refresh.
              </p>
            )}
            <div className="space-y-1.5">
              {(devices ?? []).map((d) => (
                <label
                  key={d.address}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 ${printer?.address === d.address ? "border-blue bg-blue/5" : "border-navy/15"}`}
                >
                  <input type="radio" name="printer" checked={printer?.address === d.address} onChange={() => setPrinter(d)} className="accent-blue" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-navy">{d.name}</span>
                    <span className="block text-[11px] text-navy/40">{d.address}</span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        {connection === "browser" && (
          <div className="space-y-2 rounded-lg bg-cream-dark/60 px-3 py-2.5 text-xs text-navy/70">
            {isIos() ? (
              <>
                <p>
                  Safari on iPhone can&apos;t talk to Bluetooth printers. To print straight to the receipt printer, open Blue Ledger in the free{" "}
                  <span className="font-bold text-navy">Bluefy</span> browser from the App Store and set the printer up there.
                </p>
                <p>In Safari, Print opens the iPhone&apos;s print sheet instead.</p>
              </>
            ) : (
              <p>This browser can&apos;t talk to Bluetooth printers — Print opens the print sheet instead. For direct printing, use Chrome.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-cream-dark p-1">
          {([58, 80] as const).map((width) => (
            <button
              key={width}
              type="button"
              onClick={() => setPaperWidth(width)}
              className={`rounded-md py-2 text-xs font-bold ${paperWidth === width ? "bg-white text-navy shadow-sm" : "text-navy/50"}`}
            >
              {width}mm paper
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-navy">
          <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} className="size-4 accent-blue" />
          Print every sale automatically
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void testPrint()}
            disabled={busy !== null || !ready}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-navy/20 py-3 text-sm font-bold text-navy disabled:opacity-50"
          >
            {busy === "testing" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Printer className="size-4" aria-hidden="true" />}
            Test print
          </button>
          <button type="button" onClick={save} disabled={!ready} className="rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
