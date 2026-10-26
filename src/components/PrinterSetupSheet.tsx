"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer, RefreshCw } from "lucide-react";
import { getPrinterSettings, listPairedPrinters, printerErrorMessage, printTestPage, savePrinterSettings, type PrinterSettings } from "@/lib/printer";
import { BottomSheet, SheetError } from "./BottomSheet";

/**
 * Pick this phone's receipt printer from the Bluetooth devices already paired in Android settings
 * (pairing itself happens there, once — usually PIN 0000 or 1234), choose the paper width, and
 * whether every sale prints automatically. Saved on this phone only.
 */
export function PrinterSetupSheet({ onClose, onSaved }: { onClose: () => void; onSaved: (settings: PrinterSettings) => void }) {
  const existing = getPrinterSettings();
  const [devices, setDevices] = useState<Array<{ name: string; address: string }> | null>(null);
  const [address, setAddress] = useState(existing?.address ?? "");
  const [paperWidth, setPaperWidth] = useState<58 | 80>(existing?.paperWidth ?? 58);
  const [autoPrint, setAutoPrint] = useState(existing?.autoPrint ?? true);
  const [busy, setBusy] = useState<"loading" | "testing" | null>("loading");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function fetchDevices(): void {
    listPairedPrinters()
      .then((found) => {
        setDevices(found);
        if (found.length === 1) setAddress((current) => current || found[0]!.address);
      })
      .catch((err) => setError(printerErrorMessage(err)))
      .finally(() => setBusy(null));
  }

  function loadDevices(): void {
    setBusy("loading");
    setError(null);
    fetchDevices();
  }

  // Bluetooth may prompt for permission the first time — only on open, never per render.
  useEffect(fetchDevices, []);

  function current(): PrinterSettings | null {
    const device = devices?.find((d) => d.address === address);
    return device ? { address: device.address, name: device.name, paperWidth, autoPrint } : null;
  }

  async function testPrint(): Promise<void> {
    const settings = current();
    if (!settings) return setError("Choose a printer first.");
    setBusy("testing");
    setError(null);
    setNotice(null);
    try {
      await printTestPage(settings);
      setNotice("Test page sent — check the printer.");
    } catch (err) {
      setError(printerErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function save(): void {
    const settings = current();
    if (!settings) return setError("Choose a printer first.");
    savePrinterSettings(settings);
    onSaved(settings);
  }

  return (
    <BottomSheet title="Receipt Printer" subtitle="Saved on this phone only." onClose={onClose}>
      <div className="space-y-3">
        <SheetError message={error} />
        {notice && <p className="text-xs font-semibold text-green">{notice}</p>}

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
            <label key={d.address} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 ${address === d.address ? "border-blue bg-blue/5" : "border-navy/15"}`}>
              <input type="radio" name="printer" checked={address === d.address} onChange={() => setAddress(d.address)} className="accent-blue" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-navy">{d.name}</span>
                <span className="block text-[11px] text-navy/40">{d.address}</span>
              </span>
            </label>
          ))}
        </div>

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
            disabled={busy !== null || !address}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-navy/20 py-3 text-sm font-bold text-navy disabled:opacity-50"
          >
            {busy === "testing" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Printer className="size-4" aria-hidden="true" />}
            Test print
          </button>
          <button type="button" onClick={save} disabled={!address} className="rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
