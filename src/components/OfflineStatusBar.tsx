"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CloudOff, CloudUpload, RefreshCw, Trash2 } from "lucide-react";
import { formatCents } from "@/lib/money";
import { discardQueuedSale, flushOutbox, listQueuedSales, onOutboxChange, retryQueuedSale, type QueuedSale } from "@/lib/sales-outbox";
import { BottomSheet } from "./BottomSheet";

/** While anything is waiting, try again this often — on top of retrying the moment the phone says
 * it's back online. */
const RETRY_MS = 20_000;

/**
 * The strip under the header that keeps offline selling honest: shows when the phone is offline,
 * how many sales are waiting to sync, and any SERVER refused ("needs attention" — never silently
 * dropped, money was taken for them). Drives the outbox's sync loop for the whole app, so queued sales
 * go out whichever tab is open. After a sync it says what went through, including products a sale
 * took below zero, so someone can recount.
 */
export function OfflineStatusBar({ currency }: { currency: string }) {
  const [queued, setQueued] = useState<QueuedSale[]>(() => (typeof window === "undefined" ? [] : listQueuedSales()));
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [syncing, setSyncing] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (listQueuedSales().every((s) => s.status !== "pending")) return;
    setSyncing(true);
    try {
      const synced = await flushOutbox();
      if (synced.length > 0) {
        const short = [...new Set(synced.flatMap((s) => s.stockShortfalls))];
        setReport(
          `Synced ${synced.length} offline sale${synced.length === 1 ? "" : "s"}.` + (short.length > 0 ? ` Stock went below zero for: ${short.join(", ")} — please recount.` : ""),
        );
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => setQueued(listQueuedSales());
    const goOnline = () => {
      setOnline(true);
      void sync();
    };
    const goOffline = () => setOnline(false);
    // First attempt on the next tick (not inside the effect body itself), then on every reconnect/tick.
    const firstSync = window.setTimeout(() => void sync(), 0);
    const unsubscribe = onOutboxChange(refresh);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = window.setInterval(() => void sync(), RETRY_MS);
    return () => {
      unsubscribe();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(timer);
      window.clearTimeout(firstSync);
    };
  }, [sync]);

  const pending = queued.filter((s) => s.status === "pending");
  const failed = queued.filter((s) => s.status === "failed");

  if (online && queued.length === 0 && !report) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (queued.length > 0 ? setSheetOpen(true) : setReport(null))}
        className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-bold ${
          failed.length > 0 ? "bg-red text-white" : !online ? "bg-navy-deep text-white" : report && queued.length === 0 ? "bg-green/15 text-green" : "bg-gold/20 text-gold-text"
        }`}
      >
        {failed.length > 0 ? (
          <AlertTriangle className="size-4 flex-none" aria-hidden="true" />
        ) : !online ? (
          <CloudOff className="size-4 flex-none" aria-hidden="true" />
        ) : (
          <CloudUpload className={`size-4 flex-none ${syncing ? "animate-pulse" : ""}`} aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          {failed.length > 0
            ? `${failed.length} offline sale${failed.length === 1 ? "" : "s"} need${failed.length === 1 ? "s" : ""} attention — tap to fix`
            : pending.length > 0
              ? `${pending.length} sale${pending.length === 1 ? "" : "s"} saved on this phone — ${online ? (syncing ? "syncing…" : "will sync shortly") : "will sync when back online"}`
              : !online
                ? "Offline — you can keep selling; sales are saved on this phone"
                : report}
        </span>
      </button>

      {sheetOpen && (
        <BottomSheet title="Offline Sales" subtitle="Saved on this phone until the server accepts them." onClose={() => setSheetOpen(false)}>
          <div className="space-y-2">
            {queued.length === 0 && <p className="py-6 text-center text-sm text-navy/50">All synced.</p>}
            {queued.map((sale) => (
              <div key={sale.id} className={`rounded-lg border p-3 ${sale.status === "failed" ? "border-red/40 bg-red/5" : "border-navy/15"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy">{sale.label}</p>
                    <p className="text-[11px] text-navy/50">
                      {new Date(sale.queuedAt).toLocaleString()} · {formatCents(sale.totalCents, currency)}
                    </p>
                  </div>
                  <span className={`flex-none text-[10px] font-extrabold uppercase ${sale.status === "failed" ? "text-red" : "text-gold-text"}`}>
                    {sale.status === "failed" ? "Refused" : "Waiting"}
                  </span>
                </div>
                {sale.error && <p className="mt-1.5 text-xs font-semibold text-red">{sale.error}</p>}
                {sale.status === "failed" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        retryQueuedSale(sale.id);
                        void sync();
                      }}
                      className="flex items-center gap-1 rounded-md border border-navy/20 px-2.5 py-1.5 text-[11px] font-bold text-navy"
                    >
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirmDiscard !== sale.id) return setConfirmDiscard(sale.id);
                        discardQueuedSale(sale.id);
                        setConfirmDiscard(null);
                      }}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-bold ${confirmDiscard === sale.id ? "bg-red text-white" : "border border-red/40 text-red"}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      {confirmDiscard === sale.id ? "Tap again — the money was already taken" : "Discard"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {pending.length > 0 && online && (
            <button
              type="button"
              disabled={syncing}
              onClick={() => void sync()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
              Sync now
            </button>
          )}
        </BottomSheet>
      )}
    </>
  );
}
