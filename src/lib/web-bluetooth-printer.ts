/**
 * ESC/POS over Web Bluetooth — prints from the PWA itself (Chrome on Android/desktop, and Bluefy on
 * iPhone) to a Bluetooth LE thermal printer, no app install. Same approach as Hotelier's
 * thermalPrinter.ts, which is proven on the printers we supply: pick the printer once from the
 * browser's own device list; after that the browser remembers the permission and this reconnects by
 * itself (navigator.bluetooth.getDevices), so later prints need no picker.
 */

// Minimal Web Bluetooth typings — just what's used here (not in TypeScript's DOM lib).
type GattCharacteristic = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
};
type GattService = { getCharacteristics(): Promise<GattCharacteristic[]> };
type GattServer = { connected: boolean; connect(): Promise<GattServer>; getPrimaryService(uuid: number | string): Promise<GattService> };
type BtDevice = { id: string; name?: string; gatt?: GattServer };
type BtApi = {
  requestDevice(options: { filters: Array<{ services: Array<number | string> }>; optionalServices?: Array<number | string> }): Promise<BtDevice>;
  getDevices?: () => Promise<BtDevice[]>;
};

function bluetooth(): BtApi | null {
  return typeof navigator !== "undefined" && "bluetooth" in navigator ? ((navigator as unknown as { bluetooth: BtApi }).bluetooth ?? null) : null;
}

/** The "serial over BLE" services cheap thermal printers expose — 0x18F0 first (Hotelier's, the
 * de-facto standard), then the other common ones so a slightly different model still connects. */
const PRINTER_SERVICES: Array<number | string> = [0x18f0, "e7810a71-73ae-499d-8c15-faa9aef0c3f2", 0xff00, 0xffe0, 0xae30];

/** Bytes per write — BLE packets are small; 180 with a short pause is what Hotelier settled on. */
const CHUNK = 180;
const CHUNK_PAUSE_MS = 20;

export function webBluetoothAvailable(): boolean {
  return bluetooth() !== null;
}

let connected: { deviceId: string; characteristic: GattCharacteristic } | null = null;

async function writableCharacteristic(server: GattServer): Promise<GattCharacteristic> {
  for (const uuid of PRINTER_SERVICES) {
    let service: GattService;
    try {
      service = await server.getPrimaryService(uuid);
    } catch {
      continue;
    }
    const characteristics = await service.getCharacteristics();
    const writable = characteristics.find((c) => c.properties.writeWithoutResponse || c.properties.write);
    if (writable) return writable;
  }
  throw new Error("This Bluetooth device doesn't accept print data — make sure it's a receipt printer.");
}

async function connect(device: BtDevice): Promise<GattCharacteristic> {
  if (!device.gatt) throw new Error("This device can't be used as a printer.");
  const server = await device.gatt.connect();
  const characteristic = await writableCharacteristic(server);
  connected = { deviceId: device.id, characteristic };
  return characteristic;
}

/** Opens the browser's Bluetooth picker (must come from a tap). Returns the printer to remember. */
export async function pairBluetoothPrinter(): Promise<{ id: string; name: string }> {
  const bt = bluetooth();
  if (!bt) throw new Error("This browser can't use Bluetooth.");
  const device = await bt.requestDevice({ filters: PRINTER_SERVICES.map((s) => ({ services: [s] })), optionalServices: PRINTER_SERVICES });
  await connect(device);
  return { id: device.id, name: device.name || "Bluetooth printer" };
}

/** Reconnects to the remembered printer without the picker when the browser allows it. */
async function reconnect(deviceId: string): Promise<GattCharacteristic> {
  const bt = bluetooth();
  if (!bt) throw new Error("This browser can't use Bluetooth.");
  const devices = (await bt.getDevices?.()) ?? [];
  const device = devices.find((d) => d.id === deviceId) ?? devices[0];
  if (!device) throw new Error("The printer isn't connected — open Printer settings and tap Connect printer.");
  return connect(device);
}

export async function printViaWebBluetooth(deviceId: string, bytes: Uint8Array): Promise<void> {
  let characteristic = connected?.deviceId === deviceId ? connected.characteristic : await reconnect(deviceId);
  const write = async (c: GattCharacteristic) => {
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const chunk = bytes.slice(i, i + CHUNK);
      if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(chunk);
      else await c.writeValueWithResponse(chunk);
      await new Promise((resolve) => setTimeout(resolve, CHUNK_PAUSE_MS));
    }
  };
  try {
    await write(characteristic);
  } catch {
    // The link drops when the printer sleeps or goes out of range — reconnect once and retry.
    connected = null;
    characteristic = await reconnect(deviceId);
    await write(characteristic);
  }
}
