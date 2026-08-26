"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Download, Loader2, Package, RotateCcw, Share2, X } from "lucide-react";
import { api, ApiError, getShareDownloadUrl } from "@/lib/api";
import { getIncludeWhatsappPreview, setIncludeWhatsappPreview } from "@/lib/share-preferences";
import type { MobileDeliveryNote } from "@/lib/types";
import { CheckboxField } from "./CheckboxField";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="border-b border-dotted border-navy/15 py-1">
      <span className="block text-[9px] font-extrabold uppercase tracking-wide text-navy/40">{label}</span>
      <span className="text-sm font-bold text-navy">{value}</span>
    </div>
  );
}

/** View + share a delivery note attached to a receipt/invoice/quotation — mirrors
 * DocumentDetailModal's own Download/Share handlers exactly, just pointed at the "*_delivery" share
 * entity instead of the parent document, and DESKTOP's own DeliveryNotePreview for which fields to
 * show, including the "Mark as Delivered" toggle (DeliveryNotePreview.tsx's own
 * handleToggleDelivered). canManageDelivery gates the button the same way DESKTOP gates it with
 * "sales":"edit" — SERVER still enforces the real permission regardless. */
export function DeliveryNoteModal({
  saleId,
  kind,
  canManageDelivery,
  onClose,
  onDeliveredChange,
}: {
  saleId: string;
  kind: "sale" | "quotation";
  canManageDelivery: boolean;
  onClose: () => void;
  onDeliveredChange?: (isDelivered: boolean) => void;
}) {
  const [note, setNote] = useState<MobileDeliveryNote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [togglingDelivered, setTogglingDelivered] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [includeWhatsappPreview, setIncludeWhatsappPreviewState] = useState(() => getIncludeWhatsappPreview());

  const entity = kind === "quotation" ? "quotation_delivery" : "sale_delivery";

  useEffect(() => {
    let cancelled = false;
    const fetchNote = kind === "quotation" ? api.getQuotationDeliveryNote(saleId) : api.getSaleDeliveryNote(saleId);
    fetchNote
      .then((result) => {
        if (!cancelled) setNote(result);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Could not load this delivery note.");
      });
    return () => {
      cancelled = true;
    };
  }, [saleId, kind]);

  function handleToggleIncludeWhatsappPreview(next: boolean): void {
    setIncludeWhatsappPreviewState(next);
    setIncludeWhatsappPreview(next);
  }

  async function handleDownload(): Promise<void> {
    setDownloading(true);
    setActionError(null);
    setNotice(null);
    try {
      const link = await api.createShareLink(entity, saleId, true);
      const token = link.url.split("/").pop() as string;
      const anchor = document.createElement("a");
      anchor.href = getShareDownloadUrl(token);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setNotice("Downloading — check your device's Downloads.");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't prepare the download.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleToggleDelivered(): Promise<void> {
    if (!note) return;
    setTogglingDelivered(true);
    setActionError(null);
    try {
      const next = !note.isDelivered;
      await api.setDeliveryDelivered(kind, saleId, next);
      setNote((prev) => (prev ? { ...prev, isDelivered: next, deliveredAt: next ? new Date().toISOString() : null } : prev));
      onDeliveredChange?.(next);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update delivery status.");
    } finally {
      setTogglingDelivered(false);
    }
  }

  async function handleShare(): Promise<void> {
    setSharing(true);
    setActionError(null);
    setNotice(null);
    try {
      const link = await api.createShareLink(entity, saleId, includeWhatsappPreview);
      if (navigator.share) {
        await navigator.share({ title: `Delivery Note ${note?.deliveryNoteNumber ?? ""}`.trim(), text: link.message, url: link.url });
      } else {
        await navigator.clipboard.writeText(`${link.message}\n\n${link.url}`);
        setNotice("Copied to clipboard — paste it anywhere to share.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setActionError(err instanceof ApiError ? err.message : "Couldn't prepare this share.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <p className="flex items-center gap-1.5 font-display text-lg text-navy">
              <Package className="size-4 text-blue" aria-hidden="true" />
              Delivery Note
            </p>
            {note && <p className="text-xs text-navy/50">{note.deliveryNoteNumber}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loadError && <p className="mb-3 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{loadError}</p>}
          {!note && !loadError && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}

          {note && (
            <div>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                  note.isDelivered ? "border-green text-green" : "border-gold text-gold-text"
                }`}
              >
                {note.isDelivered ? <CheckCircle2 className="size-3" aria-hidden="true" /> : <Clock className="size-3" aria-hidden="true" />}
                {note.isDelivered ? "Delivered" : "Pending Delivery"}
              </span>

              {canManageDelivery && (
                <button
                  type="button"
                  onClick={() => void handleToggleDelivered()}
                  disabled={togglingDelivered}
                  className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold disabled:opacity-50 ${
                    note.isDelivered ? "border border-navy/15 bg-white text-navy" : "bg-green text-white"
                  }`}
                >
                  {togglingDelivered ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : note.isDelivered ? (
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  )}
                  {note.isDelivered ? "Mark as Not Delivered" : "Mark as Delivered"}
                </button>
              )}

              <div className="mt-3 rounded-lg border border-navy/10 bg-cream-dark/40 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-navy/40">Deliver To</p>
                <div className="mt-1 space-y-0.5">
                  <Field label="Recipient" value={note.recipientName} />
                  <Field label="Address" value={note.deliveryAddress} />
                  <Field label="Town" value={[note.town, note.country].filter(Boolean).join(", ") || null} />
                  <Field label="Notes" value={note.deliveryNotes} />
                </div>
              </div>

              {(note.riderName || note.riderPhone) && (
                <div className="mt-2 rounded-lg border border-navy/10 bg-cream-dark/40 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-navy/40">Rider</p>
                  <div className="mt-1 space-y-0.5">
                    <Field label="Name" value={note.riderName} />
                    <Field label="Phone" value={note.riderPhone} />
                    <Field label="Company" value={note.riderCompany} />
                    <Field label="Vehicle" value={note.riderVehicleDescription} />
                  </div>
                </div>
              )}

              <p className="mt-3 text-[11px] font-semibold text-navy/50">
                {note.sourceDocumentLabel}: {note.sourceDocumentNumber ?? "—"}
              </p>

              {notice && <p className="mt-3 rounded border border-green/30 bg-green/10 px-3 py-2 text-xs font-bold text-green">{notice}</p>}
              {actionError && <p className="mt-3 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{actionError}</p>}

              <CheckboxField
                label="Include preview in WhatsApp message"
                checked={includeWhatsappPreview}
                onChange={handleToggleIncludeWhatsappPreview}
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={downloading}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-navy/15 bg-white py-2.5 text-xs font-bold text-navy disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  disabled={sharing}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-blue py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {sharing ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Share2 className="size-3.5" aria-hidden="true" />}
                  Share
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
