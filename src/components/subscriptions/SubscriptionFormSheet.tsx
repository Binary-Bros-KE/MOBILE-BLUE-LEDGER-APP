"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { centsToPriceText, priceTextToCents } from "@/lib/money";
import { DEFAULT_SUBSCRIPTION_PERIOD_DAYS, endDateFor, isValidDate, localTodayIso } from "@/lib/subscription-schedule";
import type { MobileCustomer, MobileSubscription, MobileSubscriptionServiceSuggestion } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { formatSubscriptionDate } from "./subscription-ui";

const QUICK_PERIODS = [7, 30, 60, 90, 365];

/** New subscription from the phone. The end date shows live; a remembered service fills in its usual
 * period and price. The id is minted once per sheet, so a retry after a dropped connection can't add it
 * twice. Tracking only: the payment is rung up at Checkout as usual. */
export function SubscriptionFormSheet({
  suggestions,
  onClose,
  onSaved,
}: {
  suggestions: MobileSubscriptionServiceSuggestion[];
  onClose: () => void;
  onSaved: (subscription: MobileSubscription) => void;
}) {
  const [customers, setCustomers] = useState<MobileCustomer[] | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [startDate, setStartDate] = useState(localTodayIso());
  const [periodDays, setPeriodDays] = useState(String(DEFAULT_SUBSCRIPTION_PERIOD_DAYS));
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscriptionId = useRef(`sub_${crypto.randomUUID()}`);

  useEffect(() => {
    api
      .listCustomers()
      .then(setCustomers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load customers."));
  }, []);

  const selected = customers?.find((customer) => customer.id === customerId) ?? null;
  const matches = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term || !customers) return [];
    return customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.customerCode}`.toLowerCase().includes(term)).slice(0, 20);
  }, [customers, customerSearch]);

  const period = Number(periodDays);
  const periodValid = Number.isInteger(period) && period >= 1 && period <= 3660;
  const endDate = isValidDate(startDate) && periodValid ? endDateFor(startDate, period) : null;

  function pickService(name: string): void {
    setServiceName(name);
    const match = suggestions.find((suggestion) => suggestion.serviceName.toLowerCase() === name.trim().toLowerCase());
    if (!match) return;
    if (periodDays === String(DEFAULT_SUBSCRIPTION_PERIOD_DAYS)) setPeriodDays(String(match.periodDays));
    if (!amount && match.amountCents !== null) setAmount(centsToPriceText(match.amountCents));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!customerId) return setError("Choose the customer.");
    if (!serviceName.trim()) return setError("Enter the service, e.g. DStv Compact.");
    if (!endDate) return setError("Enter a valid start date and period.");
    setSaving(true);
    setError(null);
    try {
      const saved = await api.createSubscription({
        id: subscriptionId.current,
        customerId,
        serviceName: serviceName.trim(),
        accountNumber: accountNumber.trim() || null,
        startDate,
        periodDays: period,
        amountCents: amount.trim() ? Math.round(priceTextToCents(amount) ?? 0) : null,
        notes: null,
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this subscription.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="New Subscription" subtitle="Tracks it and its reminders. Ring up the payment at Checkout." onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <SheetError message={error} />
        <SheetField label="Customer">
          {selected ? (
            <div className="flex items-center justify-between rounded-lg border border-blue/40 bg-blue/5 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy">{selected.name}</p>
                <p className="text-xs text-navy/50">{selected.phone}</p>
              </div>
              <button type="button" onClick={() => setCustomerId(null)} aria-label="Change customer" className="grid size-8 flex-none place-items-center text-navy/40">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder={customers ? "Search name or phone" : "Loading customers…"}
                className={`${sheetInputClass} pl-9`}
              />
              {matches.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-navy/15 bg-white shadow-lg">
                  {matches.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        setCustomerId(customer.id);
                        setCustomerSearch("");
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm active:bg-cream-dark"
                    >
                      <span className="font-bold text-navy">{customer.name}</span>
                      <span className="text-xs text-navy/50">{customer.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </SheetField>
        <SheetField label="Service">
          <input list="mobile-subscription-services" value={serviceName} onChange={(e) => pickService(e.target.value)} placeholder="e.g. DStv Compact" className={sheetInputClass} />
          <datalist id="mobile-subscription-services">
            {suggestions.map((suggestion) => (
              <option key={suggestion.serviceName} value={suggestion.serviceName} />
            ))}
          </datalist>
        </SheetField>
        <SheetField label="Smartcard / IUC number (optional)">
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" className={sheetInputClass} />
        </SheetField>
        <div className="grid grid-cols-2 gap-3">
          <SheetField label="Start date">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={sheetInputClass} />
          </SheetField>
          <SheetField label="Period (days)">
            <input inputMode="numeric" value={periodDays} onChange={(e) => setPeriodDays(e.target.value.replace(/\D/g, ""))} className={sheetInputClass} />
          </SheetField>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PERIODS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setPeriodDays(String(days))}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${periodDays === String(days) ? "border-navy bg-navy text-white" : "border-navy/15 text-navy/60"}`}
            >
              {days === 365 ? "1 year" : `${days} days`}
            </button>
          ))}
        </div>
        <SheetField label="Amount (optional)">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={sheetInputClass} />
        </SheetField>
        <div className="rounded-lg border border-dashed border-navy/15 bg-cream-dark/40 px-3 py-2">
          <p className="text-[10px] font-extrabold tracking-wide text-navy/50 uppercase">Ends on</p>
          <p className="font-display text-navy">{endDate ? formatSubscriptionDate(endDate) : "—"}</p>
        </div>
        <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50">
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Add Subscription"}
        </button>
      </form>
    </BottomSheet>
  );
}
