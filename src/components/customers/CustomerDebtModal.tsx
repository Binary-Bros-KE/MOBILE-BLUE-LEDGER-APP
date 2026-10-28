"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, Loader2, Pencil, Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { centsToPriceText, formatCents, priceTextToCents } from "@/lib/money";
import type { CollectCustomerPaymentResult, MobileCustomerDebt, MobileCustomerWithBalance, PaymentMethodOption } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { DocumentDetailModal } from "../DocumentDetailModal";

/** "5 Sep" this year, "5 Sep 2025" otherwise — short enough to keep a debt row's dates on one line. */
function shortDate(value: string): string {
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/**
 * What a customer owes — their unpaid invoices, oldest first — and, with sales.edit, Collect
 * Payment: one amount that SERVER applies across those invoices oldest first, each slice recorded as
 * an ordinary invoice payment (exactly what DESKTOP would show had each invoice been paid one by
 * one). The payment id is minted once per sheet, so a retry after a dropped connection can never
 * charge the customer twice. After saving, the sheet shows which invoices the money went to.
 */
export function CustomerDebtModal({
  customer,
  currency,
  canCollect,
  onEdit,
  onClose,
  onPaid,
}: {
  customer: MobileCustomerWithBalance;
  currency: string;
  canCollect: boolean;
  /** customers.edit — opens CustomerEditModal (the tab closes this sheet first, so they never stack). */
  onEdit?: () => void;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [debt, setDebt] = useState<MobileCustomerDebt | null>(null);
  const [methods, setMethods] = useState<PaymentMethodOption[] | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CollectCustomerPaymentResult | null>(null);
  const paymentId = useRef(`payment_${crypto.randomUUID()}`);
  /** The invoice opened from the list — the same full invoice view as the Invoices tab. */
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const money = (cents: number) => formatCents(cents, currency);

  function loadDebt(): void {
    api
      .getCustomerDebt(customer.id)
      .then((d) => {
        setDebt(d);
        setAmount(centsToPriceText(d.totalDueCents));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load what this customer owes."));
  }

  useEffect(loadDebt, [customer.id]);

  function startCollecting(): void {
    setCollecting(true);
    if (!methods) {
      api
        .listPaymentMethods()
        .then(setMethods)
        .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load payment methods."));
    }
  }

  const method = methods?.find((m) => m.id === methodId) ?? null;

  async function handleCollect(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!debt) return;
    const amountCents = priceTextToCents(amount);
    if (!methodId) return setError("Choose how they paid.");
    if (!amountCents || amountCents <= 0) return setError("Enter an amount.");
    if (amountCents > debt.totalDueCents) return setError(`That's more than the ${money(debt.totalDueCents)} they owe.`);
    if (method?.requiresReference && !reference.trim()) return setError(`${method.name} needs a reference.`);

    setSaving(true);
    setError(null);
    try {
      const res = await api.collectCustomerPayment(customer.id, {
        id: paymentId.current,
        paymentMethodId: methodId,
        amountCents,
        reference: reference.trim() || null,
        notes: null,
      });
      setResult(res);
      onPaid();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <BottomSheet title={customer.name} subtitle={debt ? `Owes ${money(debt.totalDueCents)}` : customer.phone} onClose={onClose}>
      {result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-green/10 px-3 py-2.5 text-sm font-bold text-green">
            <CheckCircle2 className="size-4 flex-none" aria-hidden="true" />
            Payment recorded
          </div>
          <div className="space-y-1.5 text-xs">
            {result.allocations.map((a) => (
              <div key={a.saleId} className="flex justify-between gap-2">
                <span className="text-navy/70">{a.invoiceNumber}</span>
                <span className="font-bold text-navy">{money(a.amountCents)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-dashed border-navy/15 pt-2 text-sm">
            <span className="text-navy/60">Still owing</span>
            <span className="font-display text-navy">{money(result.remainingDueCents)}</span>
          </div>
          <button type="button" onClick={onClose} className="w-full rounded-lg bg-navy py-3 text-sm font-bold text-white">
            Done
          </button>
        </div>
      ) : !debt ? (
        error ? <SheetError message={error} /> : <p className="py-10 text-center text-sm text-navy/50">Loading…</p>
      ) : (
        <div className="space-y-3">
          <SheetError message={error} />
          {onEdit && (
            <button type="button" onClick={onEdit} className="flex items-center gap-1 text-xs font-bold text-blue">
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit details & credit limit
            </button>
          )}
          {debt.invoices.length === 0 && <p className="py-6 text-center text-sm text-navy/50">Nothing owed right now.</p>}
          <div className="space-y-2">
            {debt.invoices.map((invoice) => {
              const overdue = invoice.dueDate !== null && new Date(invoice.dueDate) < new Date();
              return (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => setOpenInvoiceId(invoice.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-navy/10 px-3 py-2 text-left active:bg-cream-dark"
                >
                  {/* Sizes set on each line — a <button> doesn't carry the small text the old plain
                      rows had, which made these rows balloon. Short dates keep it to two lines. */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-navy">{invoice.invoiceNumber}</p>
                    <p className={`text-[11px] leading-snug ${overdue ? "font-semibold text-red" : "text-navy/50"}`}>
                      {shortDate(invoice.issuedAt)}
                      {invoice.dueDate ? ` · due ${shortDate(invoice.dueDate)}` : ""}
                      {overdue ? " · overdue" : ""}
                    </p>
                  </div>
                  <div className="flex-none text-right">
                    <p className="text-xs font-bold text-navy">{money(invoice.outstandingCents)}</p>
                    {invoice.amountPaidCents > 0 && <p className="text-[11px] text-navy/40">of {money(invoice.grandTotalCents)}</p>}
                  </div>
                  <ChevronRight className="size-4 flex-none text-navy/30" aria-hidden="true" />
                </button>
              );
            })}
          </div>

          {canCollect && debt.totalDueCents > 0 && !collecting && (
            <button
              type="button"
              onClick={startCollecting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white"
            >
              <Wallet className="size-4" aria-hidden="true" />
              Collect Payment
            </button>
          )}

          {collecting && (
            <form onSubmit={handleCollect} className="space-y-3 border-t border-dashed border-navy/15 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <SheetField label="Amount received">
                  <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={sheetInputClass} />
                </SheetField>
                <SheetField label="Paid with">
                  <select value={methodId} onChange={(e) => setMethodId(e.target.value)} className={sheetInputClass}>
                    <option value="" disabled>
                      Choose
                    </option>
                    {(methods ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </SheetField>
              </div>
              <SheetField label={method?.requiresReference ? "Reference" : "Reference (optional)"}>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. M-Pesa code" className={sheetInputClass} />
              </SheetField>
              <p className="text-[11px] text-navy/50">Applied to the oldest invoices first.</p>
              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {saving ? "Recording…" : "Record Payment"}
              </button>
            </form>
          )}
        </div>
      )}
    </BottomSheet>
    {openInvoiceId && (
      // Rendered outside the sheet (a fixed child of its animated panel would position against it)
      // and above it — this sheet is z-[60], the invoice view's own backdrop z-50.
      <div className="relative z-[70]">
        <DocumentDetailModal
          saleId={openInvoiceId}
          onClose={() => setOpenInvoiceId(null)}
          // A payment recorded on the invoice changes what's owed here — refresh the list behind it.
          onChanged={() => {
            loadDebt();
            onPaid();
          }}
          canManageDelivery={canCollect}
        />
      </div>
    )}
    </>
  );
}
