"use client";

import { useEffect, useState } from "react";
import { FileMinus2, Loader2, Share2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { MobileCreditNoteListItem } from "@/lib/types";
import { ShareSheet } from "./ShareSheet";

/**
 * The credit notes on a receipt or invoice (approved returns, and any still waiting for approval).
 * Share issues the CN number the first time (a receipt return only gets one when it's wanted) and
 * opens the usual Share sheet with the credit note's own link. Hidden when there are none.
 */
export function CreditNotesSection({
  saleId,
  currency,
  refreshKey,
  onLoaded,
}: {
  saleId: string;
  currency: string;
  /** Changes after a new request, so the list reloads. */
  refreshKey: number;
  /** How many there are: an invoice with any can't be edited any more. */
  onLoaded?: (count: number) => void;
}) {
  const [items, setItems] = useState<MobileCreditNoteListItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<{ id: string; number: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listSaleCreditNotes(saleId)
      .then((result) => {
        if (cancelled) return;
        setItems(result);
        onLoaded?.(result.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // onLoaded is a parent setter; reloading on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId, refreshKey]);

  async function share(item: MobileCreditNoteListItem): Promise<void> {
    setBusyId(item.id);
    setError(null);
    try {
      const issued = item.creditNoteNumber ? { creditNoteNumber: item.creditNoteNumber } : await api.issueCreditNote(item.id);
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, creditNoteNumber: issued.creditNoteNumber } : entry)));
      setSharing({ id: item.id, number: issued.creditNoteNumber });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't open this credit note.");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <>
      <div className="my-3 border-t border-dashed border-navy/15" />
      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-extrabold tracking-wide text-navy/50 uppercase">
        <FileMinus2 className="size-3" aria-hidden="true" />
        Credit Notes
      </p>
      {error && <p className="mb-1.5 text-[11px] font-semibold text-red">{error}</p>}
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-navy/10 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-navy">{item.creditNoteNumber ?? (item.status === "approved" ? "Return" : "Awaiting approval")}</p>
              <p className="truncate text-[11px] text-navy/50">{item.lines.join(", ")}</p>
              <p className="text-[11px] text-navy/50">
                {formatCents(item.amountCents, currency)}
                {item.refundCents ? ` · ${formatCents(item.refundCents, currency)} refunded` : ""}
              </p>
            </div>
            {item.status === "approved" ? (
              <button
                type="button"
                onClick={() => void share(item)}
                disabled={busyId !== null}
                className="flex flex-none items-center gap-1 rounded-lg border border-navy/15 px-2.5 py-1.5 text-[11px] font-bold text-navy disabled:opacity-50"
              >
                {busyId === item.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Share2 className="size-3.5" aria-hidden="true" />}
                Share
              </button>
            ) : (
              <span className="flex-none rounded-full border border-dashed border-gold px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-gold-text uppercase">
                Pending
              </span>
            )}
          </div>
        ))}
      </div>
      {sharing && (
        <div onClick={(e) => e.stopPropagation()}>
          <ShareSheet entity="credit_note" entityId={sharing.id} documentLabel={`Credit Note ${sharing.number}`} onClose={() => setSharing(null)} />
        </div>
      )}
    </>
  );
}
