import { Capacitor, registerPlugin } from "@capacitor/core";
import { buildReceipt, EscPosWriter, escposToText, LINE_WIDTH } from "./escpos";
import type { SharedDocument } from "./types";
import { printViaWebBluetooth, webBluetoothAvailable } from "./web-bluetooth-printer";

/** The native side: android/app/src/main/java/app/blueledgerpos/pos/BluetoothPrinterPlugin.java. */
type BluetoothPrinterPlugin = {
  listPairedPrinters(): Promise<{ devices: Array<{ name: string; address: string }> }>;
  print(options: { address: string; data: string }): Promise<void>;
};

const BluetoothPrinter = registerPlugin<BluetoothPrinterPlugin>("BluetoothPrinter");

/**
 * How this phone prints:
 *  - "bluetooth": Web Bluetooth from the PWA itself, straight to a Bluetooth LE thermal printer —
 *    Chrome on Android (and desktop), and the Bluefy browser on iPhone. Pick once, then automatic.
 *  - "native": the Android app's own plugin (Bluetooth Classic), when running inside that app.
 *  - "browser": the phone's print sheet with an 80/58mm receipt layout — the fallback where there
 *    is no Bluetooth access at all (iPhone Safari).
 */
export type PrinterConnection = "bluetooth" | "native" | "browser";

/** Which printer this phone uses — per phone (each till has its own printer), so it lives in this
 * device's storage, not on the server. */
export type PrinterSettings = {
  connection: PrinterConnection;
  /** Web Bluetooth device id ("bluetooth"), MAC address ("native"), "" for "browser". */
  address: string;
  name: string;
  paperWidth: 58 | 80;
  /** Print the receipt automatically after every completed sale. */
  autoPrint: boolean;
};

const STORAGE_KEY = "bl_printer";

function nativePrinterAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BluetoothPrinter");
}

/** The best way this phone can print right now. */
export function availableConnection(): PrinterConnection {
  if (nativePrinterAvailable()) return "native";
  if (webBluetoothAvailable()) return "bluetooth";
  return "browser";
}

/** Every phone can print one way or another (the print sheet at worst), so Print always shows. */
export function canPrintReceipts(): boolean {
  return true;
}

/** An iPhone/iPad — where only the Bluefy browser gives a web page Bluetooth access. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function getPrinterSettings(): PrinterSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<PrinterSettings>;
    // Saved before Web Bluetooth existed here = the Android app's printer.
    const settings = { ...saved, connection: saved.connection ?? "native" } as PrinterSettings;
    // A printer set up in another environment (e.g. Bluefy vs Safari) can't be reached from this one.
    if (settings.connection === "native" && !nativePrinterAvailable()) return null;
    if (settings.connection === "bluetooth" && !webBluetoothAvailable()) return null;
    return settings;
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

const PRINT_ROOT_ID = "bl-print-root";

/** The print-sheet fallback: the same receipt as plain monospace text on a receipt-width page, with
 * everything else on screen hidden while printing. */
function printViaBrowser(bytes: Uint8Array, paperWidth: 58 | 80): void {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;
  const style = document.createElement("style");
  style.textContent = `
    #${PRINT_ROOT_ID} { display: none; }
    @media print {
      @page { size: ${paperWidth}mm auto; margin: 2mm; }
      body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
      #${PRINT_ROOT_ID} { display: block; }
      #${PRINT_ROOT_ID} pre { margin: 0; white-space: pre; font: ${paperWidth === 58 ? 9 : 10}px/1.25 ui-monospace, Menlo, Consolas, monospace; color: #000; }
    }`;
  const pre = document.createElement("pre");
  pre.textContent = escposToText(bytes);
  root.append(style, pre);
  document.body.appendChild(root);
  window.addEventListener("afterprint", () => root.remove(), { once: true });
  window.print();
}

async function send(settings: PrinterSettings, bytes: Uint8Array): Promise<void> {
  if (settings.connection === "bluetooth") await printViaWebBluetooth(settings.address, bytes);
  else if (settings.connection === "native") await BluetoothPrinter.print({ address: settings.address, data: toBase64(bytes) });
  else printViaBrowser(bytes, settings.paperWidth);
}

export async function printDocument(doc: SharedDocument, settings: PrinterSettings): Promise<void> {
  await send(settings, buildReceipt(doc, settings.paperWidth));
}

/** A short slip that proves the printer, the pairing and the paper width are right. */
export async function printTestPage(settings: PrinterSettings): Promise<void> {
  const w = new EscPosWriter(LINE_WIDTH[settings.paperWidth]);
  w.align("center").bold(true).text("Blue Ledger POS").bold(false).text("Printer test").divider();
  w.align("left").row("Paper", `${settings.paperWidth}mm`).row("Printer", settings.name).divider();
  w.align("center").text("If this fits on one line,").text("the paper width is right.");
  await send(settings, w.feed(4).cut().toBytes());
}

/** Plugin / Web Bluetooth errors arrive as Error objects with a readable message; a dismissed
 * Bluetooth picker is a NotFoundError ("User cancelled"). */
export function printerErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === "NotFoundError") return "No printer chosen.";
  return err instanceof Error && err.message ? err.message : "Couldn't print.";
}
