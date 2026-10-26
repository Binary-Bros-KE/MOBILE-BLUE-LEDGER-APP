import { Capacitor, registerPlugin } from "@capacitor/core";
import { buildReceipt, EscPosWriter, LINE_WIDTH } from "./escpos";
import type { SharedDocument } from "./types";

/** The native side: android/app/src/main/java/app/blueledgerpos/pos/BluetoothPrinterPlugin.java. */
type BluetoothPrinterPlugin = {
  listPairedPrinters(): Promise<{ devices: Array<{ name: string; address: string }> }>;
  print(options: { address: string; data: string }): Promise<void>;
};

const BluetoothPrinter = registerPlugin<BluetoothPrinterPlugin>("BluetoothPrinter");

/** Which printer this phone uses — per phone (each till has its own printer), so it lives in this
 * device's storage, not on the server. */
export type PrinterSettings = {
  address: string;
  name: string;
  paperWidth: 58 | 80;
  /** Print the receipt automatically after every completed sale. */
  autoPrint: boolean;
};

const STORAGE_KEY = "bl_printer";

/** Printing needs the Android app (Bluetooth Classic is out of a browser's reach) — in a plain
 * browser the Print button simply isn't shown and Download/Share remain. */
export function canPrintReceipts(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BluetoothPrinter");
}

export function getPrinterSettings(): PrinterSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PrinterSettings) : null;
  } catch {
    return null;
  }
}

export function savePrinterSettings(settings: PrinterSettings | null): void {
  try {
    if (settings) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked — the printer just has to be picked again next time.
  }
}

export async function listPairedPrinters(): Promise<Array<{ name: string; address: string }>> {
  return (await BluetoothPrinter.listPairedPrinters()).devices;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function send(address: string, bytes: Uint8Array): Promise<void> {
  await BluetoothPrinter.print({ address, data: toBase64(bytes) });
}

export async function printDocument(doc: SharedDocument, settings: PrinterSettings): Promise<void> {
  await send(settings.address, buildReceipt(doc, settings.paperWidth));
}

/** A short slip that proves the printer, the pairing and the paper width are right. */
export async function printTestPage(settings: PrinterSettings): Promise<void> {
  const w = new EscPosWriter(LINE_WIDTH[settings.paperWidth]);
  w.align("center").bold(true).text("Blue Ledger POS").bold(false).text("Printer test").divider();
  w.align("left").row("Paper", `${settings.paperWidth}mm`).row("Printer", settings.name).divider();
  w.align("center").text("If this fits on one line,").text("the paper width is right.");
  await send(settings.address, w.feed(4).cut().toBytes());
}

/** Native plugin errors arrive as Error objects with the Java-side message. */
export function printerErrorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Couldn't print.";
}
