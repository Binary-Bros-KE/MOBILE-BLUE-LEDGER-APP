"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "./BottomSheet";

/** The browser's built-in barcode reader (Chrome/Edge on Android, Samsung Internet). Not in the DOM
 * typings yet, so only the bit used here is declared. */
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

/** Retail 1D codes plus QR — what shop shelves actually carry. */
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

function getDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null) as BarcodeDetectorCtor | null;
}

/** Whether camera scanning can work on this phone/browser at all — callers hide the scan button when
 * it can't (iPhones/Safari today), leaving typing or a Bluetooth scanner. */
export function cameraScanSupported(): boolean {
  return getDetectorCtor() !== null && typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Point the back camera at a barcode; the first code read is handed to `onDetected` and the camera
 * stops. Uses the browser's own BarcodeDetector (no extra library) — on a browser without it,
 * cameraScanSupported() is false and callers never open this. A Bluetooth/USB scanner needs none of
 * this: it "types" the code into the search box and presses Enter.
 */
export function BarcodeScannerSheet({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Latest callback without restarting the camera every render.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const Detector = getDetectorCtor();
    if (!Detector) return;
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let stopped = false;
    const detector = new Detector({ formats: FORMATS });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        stream = s;
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = s;
        await videoRef.current.play();
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value) {
              stopped = true;
              if ("vibrate" in navigator) navigator.vibrate(60);
              onDetectedRef.current(value);
              return;
            }
          } catch {
            // A frame that can't be read yet (camera warming up) — just try the next one.
          }
          timer = window.setTimeout(() => void tick(), 180);
        };
        void tick();
      })
      .catch(() => setError("Camera access was blocked. Allow camera access for this app in your browser settings, or type the code."));

    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <BottomSheet title="Scan Barcode" subtitle="Hold the barcode inside the frame." onClose={onClose}>
      {error ? (
        <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{error}</p>
      ) : (
        <div className="relative overflow-hidden rounded-lg bg-navy-deep">
          <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/80" aria-hidden="true" />
        </div>
      )}
    </BottomSheet>
  );
}
