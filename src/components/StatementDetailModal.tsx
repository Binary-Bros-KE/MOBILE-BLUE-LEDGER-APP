"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, Share2, X } from "lucide-react";
import { api, ApiError, getShareDownloadUrl } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { SharedStatement } from "@/lib/types";
import { Row } from "./DocumentDetailModal";

const STATUS_TONE: Record<string, string> = {
  overdue: "border-red text-red",
  partially_paid: "border-gold text-gold-text",
  unpaid: "border-blue text-blue",
  cancelled: "border-navy/30 text-navy/50",
};

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

/** Same bottom-sheet shell and Download/Share mechanics as DocumentDetailModal — a statement just
 * isn't a Sale row, so it fetches and mints its share link through the "customer_statement" entity
 * (SERVER's buildSharedStatement, reused directly — see mobile-customers-service.ts) instead of
 * /mobile/sales/:id. */
export function StatementDetailModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [doc, setDoc] = useState<SharedStatement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getStatement(customerId)
      .then((result) => {
        if (!cancelled) setDoc(result);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Could not load this statement.");
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  async function handleDownload(): Promise<void> {
    setDownloading(true);
    setActionError(null);
    setNotice(null);
    try {
      const link = await api.createShareLink("customer_statement", customerId, true);
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

  async function handleShare(): Promise<void> {
    setSharing(true);
    setActionError(null);
    setNotice(null);
    try {
      const link = await api.createShareLink("customer_statement", customerId, true);
      const label = doc ? `Statement — ${doc.customerName}` : "Statement";
      if (navigator.share) {
        await navigator.share({ title: label, text: link.message, url: link.url });
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

  const money = (cents: number) => (doc ? formatCents(cents, doc.currency) : "-");
  const availableCreditCents = doc?.creditLimitCents !== null && doc ? Math.max(0, doc.creditLimitCents! - doc.totalOutstandingCents) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-display text-lg text-navy">{doc ? `Statement — ${doc.customerName}` : "Statement"}</p>
            {doc && <p className="text-xs text-navy/50">{new Date(doc.generatedAt).toLocaleDateString()}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {loadError && <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{loadError}</p>}
        {!doc && !loadError && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}

        {doc && (
          <>
            <div className="rounded-lg border border-dashed border-navy/15 bg-cream-dark/40 p-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-navy">{doc.businessName}</p>
                {doc.physicalAddress && <p className="text-xs text-navy/50">{doc.physicalAddress}</p>}
                {doc.primaryPhone && <p className="text-xs text-navy/50">{doc.primaryPhone}</p>}
              </div>

              <div className="my-3 border-t border-dashed border-navy/15" />
              <div className="space-y-0.5 text-xs text-navy/70">
                <Row label="Customer" value={doc.customerName} />
                <Row label="Phone" value={doc.customerPhone} />
                {doc.creditLimitCents !== null && availableCreditCents !== null && (
                  <>
                    <Row label="Credit Limit" value={money(doc.creditLimitCents)} />
                    <Row label="Available Credit" value={money(availableCreditCents)} />
                  </>
                )}
              </div>

              <div className="my-3 border-t border-dashed border-navy/15" />
              <div className="space-y-3">
                {doc.invoices.length === 0 ? (
                  <p className="text-center text-xs text-navy/50">No outstanding invoices</p>
                ) : (
                  doc.invoices.map((invoice, index) => (
                    <div
                      key={invoice.id}
                      className={index < doc.invoices.length - 1 ? "border-b border-dashed border-navy/10 pb-3" : ""}
                    >
                      <div className="flex items-start justify-between gap-2 text-xs">
                        <p className="font-bold text-navy">{invoice.invoiceNumber ?? "-"}</p>
                        <span
                          className={`rounded-full border border-dashed px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase ${STATUS_TONE[invoice.paymentStatus] ?? "border-navy/30 text-navy/50"}`}
                        >
                          {formatStatus(invoice.paymentStatus)}
                        </span>
                      </div>
                      <p className="text-[11px] text-navy/40">
                        Due {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"}
                      </p>
                      <div className="mt-1 space-y-0.5 text-xs">
                        <Row label="Invoice Value" value={money(invoice.grandTotalCents)} />
                        <Row label="Paid" value={money(invoice.amountPaidCents)} />
                        <Row label="Balance" value={money(invoice.balanceDueCents)} strong className="text-red" />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="my-3 border-t border-dashed border-navy/15" />
              <div className="space-y-1 text-xs">
                <Row label="Total Invoiced" value={money(doc.totalInvoicedCents)} />
                <Row label="Total Paid" value={money(doc.totalPaidCents)} />
                <Row label="Total Outstanding" value={money(doc.totalOutstandingCents)} strong />
              </div>
            </div>

            {actionError && (
              <p className="mt-3 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{actionError}</p>
            )}
            {notice && <p className="mt-3 text-center text-xs text-navy/50">{notice}</p>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloading}
                className="flex items-center justify-center gap-2 rounded-lg border border-navy/20 bg-white py-3 text-xs font-bold text-navy disabled:opacity-50"
              >
                {downloading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
                Download
              </button>
              <button
                type="button"
                onClick={() => void handleShare()}
                disabled={sharing}
                className="flex items-center justify-center gap-2 rounded-lg bg-navy py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                {sharing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
                Share
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
