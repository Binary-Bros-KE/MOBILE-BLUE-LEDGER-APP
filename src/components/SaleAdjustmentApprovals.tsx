"use client";

import { useEffect, useState } from "react";
import { Ban, Check, Loader2, Undo2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { MobilePendingSaleAdjustment } from "@/lib/types";

/**
 * Void and return requests waiting for a decision (tenant-wide, oldest first) — the same queue
 * DESKTOP's Approvals inbox shows. Approving puts the stock back (SERVER's
 * mobile-sale-adjustments-service.ts); rejecting leaves the sale as it is. Rendered at the top of the
 * Approvals tab, above invoice cancellations.
 */
/** `onDecided` lets the tab refresh its Recent Decisions after an approve/reject here. */
export function SaleAdjustmentApprovals({ onDecided }: { onDecided?: () => void } = {}) {
  const [items, setItems] = useState<MobilePendingSaleAdjustment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load(): void {
    api
      .listPendingSaleAdjustments()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load void and return requests."));
  }

  useEffect(load, []);

  async function decide(item: MobilePendingSaleAdjustment, decision: "approve" | "reject"): Promise<void> {
    setBusy(`${item.id}:${decision}`);
    setError(null);
    try {
      await api.decideSaleAdjustment(item.kind, item.id, decision);
      load();
      onDecided?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the decision.");
    } finally {
      setBusy(null);
    }
  }

  if (!error && (!items || items.length === 0)) return null;

  return (
    <section className="mb-5">
      <p className="mb-2 text-xs font-bold text-navy/50">Voids &amp; Returns</p>
      {error && <div className="mb-2 rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
      <div className="space-y-3">
        {(items ?? []).map((item) => (
          <div key={item.id} className="rounded-lg bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-bold text-navy">
                  {item.kind === "void" ? <Ban className="size-4 text-red" aria-hidden="true" /> : <Undo2 className="size-4 text-blue" aria-hidden="true" />}
                  {item.kind === "void" ? "Void" : "Return"} · {item.documentNumber ?? "Sale"}
                </p>
                <p className="text-[11px] text-navy/50">
                  {item.requestedByName} · {item.locationName} · {new Date(item.requestedAt).toLocaleString()}
                </p>
              </div>
              <span className="flex-none font-display text-sm text-navy">{formatCents(item.amountCents, item.currency)}</span>
            </div>
            {item.lines.length > 0 && <p className="mt-2 text-xs text-navy/70">{item.lines.join(", ")}</p>}
            <p className="mt-1.5 text-xs text-navy/70">
              <span className="font-semibold text-navy">Reason:</span> {item.reason}
              {item.notes ? ` — ${item.notes}` : ""}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void decide(item, "reject")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-navy/20 py-2.5 text-xs font-bold text-navy disabled:opacity-50"
              >
                {busy === `${item.id}:reject` ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
                Reject
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void decide(item, "approve")}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-blue py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy === `${item.id}:approve` ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
