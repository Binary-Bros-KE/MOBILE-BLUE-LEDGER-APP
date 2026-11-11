"use client";

import { useRef, useState } from "react";
import { Ban, CheckCircle2, Loader2, Mail, MessageCircle, Phone, RefreshCcw, RotateCcw, Send } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { centsToPriceText, formatCents, priceTextToCents } from "@/lib/money";
import { EA_COUNTRY_CODES, normalizePhoneForWhatsApp } from "@/lib/phone";
import {
  DEFAULT_NOTICE_TEMPLATES,
  SUBSCRIPTION_NOTICE_LABELS,
  SUBSCRIPTION_NOTICE_STAGES,
  endDateFor,
  fillNoticeTemplate,
  isValidDate,
  type SubscriptionNoticeStage,
} from "@/lib/subscription-schedule";
import type { MobileSubscription } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { StagePill, daysLeftLabel, formatSubscriptionDate } from "./subscription-ui";

type Channel = "whatsapp" | "email" | "other";
type Mode = { kind: "view" } | { kind: "send"; stage: SubscriptionNoticeStage } | { kind: "renew" };

const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: "WhatsApp", email: "Email", other: "Called / in person" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-navy/50">{label}</span>
      <span className="text-right font-bold text-navy">{value}</span>
    </div>
  );
}

/**
 * One subscription on the phone: details, the four reminders (who sent each, and when), and the
 * actions — Send reminder (opens WhatsApp or the mail app with the message ready, then Mark as sent:
 * manual by client spec), Renew, Cancel/Reactivate. Every write carries an id minted once, so a retry
 * never doubles it.
 */
export function SubscriptionDetailSheet({
  subscription,
  businessName,
  currency,
  canEdit,
  canRenew,
  initialSendStage,
  onClose,
  onChanged,
}: {
  subscription: MobileSubscription;
  businessName: string;
  currency: string;
  canEdit: boolean;
  canRenew: boolean;
  /** Opened from the reminder queue: straight to sending. */
  initialSendStage: SubscriptionNoticeStage | null;
  onClose: () => void;
  onChanged: (updated: MobileSubscription) => void;
}) {
  const [current, setCurrent] = useState(subscription);
  const [mode, setMode] = useState<Mode>(initialSendStage ? { kind: "send", stage: initialSendStage } : { kind: "view" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [phone, setPhone] = useState(subscription.customerPhone ?? "");
  const [email, setEmail] = useState(subscription.customerEmail ?? "");
  const [countryCode, setCountryCode] = useState<string>(EA_COUNTRY_CODES[0].code);
  // Opened straight from the reminder queue: the message is ready on first render.
  const [message, setMessage] = useState(() =>
    initialSendStage
      ? fillNoticeTemplate(DEFAULT_NOTICE_TEMPLATES[initialSendStage], {
          customer: subscription.customerName,
          service: subscription.serviceName,
          account: subscription.accountNumber ?? "—",
          end_date: formatSubscriptionDate(subscription.endDate),
          days: String(Math.abs(subscription.daysLeft)),
          business: businessName,
        })
      : "",
  );
  const [opened, setOpened] = useState(false);
  const noticeId = useRef(`subn_${crypto.randomUUID()}`);

  const [renewStart, setRenewStart] = useState("");
  const [renewPeriod, setRenewPeriod] = useState("");
  const [renewAmount, setRenewAmount] = useState("");
  const renewalId = useRef(`sub_${crypto.randomUUID()}`);

  const money = (cents: number) => formatCents(cents, currency);

  function noticeMessage(stage: SubscriptionNoticeStage): string {
    return fillNoticeTemplate(DEFAULT_NOTICE_TEMPLATES[stage], {
      customer: current.customerName,
      service: current.serviceName,
      account: current.accountNumber ?? "—",
      end_date: formatSubscriptionDate(current.endDate),
      days: String(Math.abs(current.daysLeft)),
      business: businessName,
    });
  }

  function startSend(stage: SubscriptionNoticeStage): void {
    setOpened(false);
    setError(null);
    setMessage(noticeMessage(stage));
    setMode({ kind: "send", stage });
  }

  function startRenew(): void {
    setError(null);
    setMode({ kind: "renew" });
    api
      .getSubscriptionRenewalDefaults(current.id)
      .then((defaults) => {
        setRenewStart(defaults.startDate);
        setRenewPeriod(String(defaults.periodDays));
        setRenewAmount(defaults.amountCents !== null ? centsToPriceText(defaults.amountCents) : "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this subscription."));
  }

  function applyUpdate(updated: MobileSubscription): void {
    setCurrent(updated);
    onChanged(updated);
  }

  function openApp(): void {
    if (channel === "whatsapp") {
      if (!phone.trim()) return setError("Enter a phone number.");
      window.location.href = `whatsapp://send?phone=${normalizePhoneForWhatsApp(phone, countryCode)}&text=${encodeURIComponent(message)}`;
    } else {
      if (!email.trim()) return setError("Enter an email address.");
      window.location.href = `mailto:${email.trim()}?subject=${encodeURIComponent(`${current.serviceName} subscription`)}&body=${encodeURIComponent(message)}`;
    }
    setError(null);
    setOpened(true);
  }

  async function markSent(stage: SubscriptionNoticeStage): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.recordSubscriptionNotice(current.id, {
        id: noticeId.current,
        stage,
        channel,
        recipient: channel === "whatsapp" ? phone.trim() || null : channel === "email" ? email.trim() || null : null,
      });
      noticeId.current = `subn_${crypto.randomUUID()}`;
      applyUpdate(updated);
      setMode({ kind: "view" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't mark the reminder as sent.");
    } finally {
      setBusy(false);
    }
  }

  async function renew(): Promise<void> {
    const period = Number(renewPeriod);
    if (!isValidDate(renewStart) || !Number.isInteger(period) || period < 1) return setError("Enter a valid start date and period.");
    setBusy(true);
    setError(null);
    try {
      const renewed = await api.renewSubscription(current.id, {
        id: renewalId.current,
        startDate: renewStart,
        periodDays: period,
        amountCents: renewAmount.trim() ? Math.round(priceTextToCents(renewAmount) ?? 0) : null,
      });
      applyUpdate(renewed);
      setMode({ kind: "view" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't renew this subscription.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "active" | "cancelled"): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      applyUpdate(await api.setSubscriptionStatus(current.id, status));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change this subscription.");
    } finally {
      setBusy(false);
    }
  }

  if (mode.kind === "send") {
    const stage = mode.stage;
    return (
      <BottomSheet title={`${SUBSCRIPTION_NOTICE_LABELS[stage]} reminder`} subtitle={`${current.customerName} · ${current.serviceName}`} onClose={() => setMode({ kind: "view" })}>
        <div className="space-y-3">
          <SheetError message={error} />
          <div className="grid grid-cols-3 gap-1.5">
            {(["whatsapp", "email", "other"] as const).map((option) => {
              const Icon = option === "whatsapp" ? MessageCircle : option === "email" ? Mail : Phone;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setChannel(option);
                    setOpened(false);
                  }}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-bold ${channel === option ? "border-navy bg-navy text-white" : "border-navy/15 text-navy"}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {option === "other" ? "Called" : CHANNEL_LABEL[option]}
                </button>
              );
            })}
          </div>
          {channel === "whatsapp" && (
            <div className="grid grid-cols-[7rem_1fr] gap-2">
              <SheetField label="Country">
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className={sheetInputClass}>
                  {EA_COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      +{c.code}
                    </option>
                  ))}
                </select>
              </SheetField>
              <SheetField label="Phone">
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={sheetInputClass} />
              </SheetField>
            </div>
          )}
          {channel === "email" && (
            <SheetField label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={sheetInputClass} />
            </SheetField>
          )}
          {channel !== "other" ? (
            <SheetField label="Message">
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className={sheetInputClass} />
            </SheetField>
          ) : (
            <p className="text-xs text-navy/60">For a customer you reminded by phone or in person — marking it stops this reminder being offered again.</p>
          )}
          {channel !== "other" && opened && (
            <p className="flex items-start gap-1.5 rounded-lg bg-blue/5 px-3 py-2 text-xs text-navy">
              <CheckCircle2 className="mt-0.5 size-4 flex-none text-blue" aria-hidden="true" />
              Once you&apos;ve pressed send there, mark it as sent here.
            </p>
          )}
          {channel !== "other" && (
            <button type="button" onClick={openApp} className={`w-full rounded-lg py-3 text-sm font-bold ${opened ? "border border-navy/20 text-navy" : "bg-blue text-white"}`}>
              {opened ? "Open again" : channel === "whatsapp" ? "Open WhatsApp" : "Open Email"}
            </button>
          )}
          {(channel === "other" || opened) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void markSent(stage)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Mark as Sent
            </button>
          )}
        </div>
      </BottomSheet>
    );
  }

  if (mode.kind === "renew") {
    const period = Number(renewPeriod);
    const newEnd = isValidDate(renewStart) && Number.isInteger(period) && period >= 1 ? endDateFor(renewStart, period) : null;
    return (
      <BottomSheet title="Renew" subtitle={`Current period ends ${formatSubscriptionDate(current.endDate)}`} onClose={() => setMode({ kind: "view" })}>
        <div className="space-y-3">
          <SheetError message={error} />
          <div className="grid grid-cols-2 gap-3">
            <SheetField label="New start date">
              <input type="date" value={renewStart} onChange={(e) => setRenewStart(e.target.value)} className={sheetInputClass} />
            </SheetField>
            <SheetField label="Period (days)">
              <input inputMode="numeric" value={renewPeriod} onChange={(e) => setRenewPeriod(e.target.value.replace(/\D/g, ""))} className={sheetInputClass} />
            </SheetField>
          </div>
          <SheetField label="Amount (optional)">
            <input inputMode="decimal" value={renewAmount} onChange={(e) => setRenewAmount(e.target.value)} className={sheetInputClass} />
          </SheetField>
          <div className="rounded-lg border border-dashed border-navy/15 bg-cream-dark/40 px-3 py-2">
            <p className="text-[10px] font-extrabold tracking-wide text-navy/50 uppercase">New end date</p>
            <p className="font-display text-navy">{newEnd ? formatSubscriptionDate(newEnd) : "—"}</p>
          </div>
          <button type="button" disabled={busy || !newEnd} onClick={() => void renew()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Renew
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title={current.serviceName} subtitle={`${current.customerName}${current.customerPhone ? ` · ${current.customerPhone}` : ""}`} onClose={onClose}>
      <div className="space-y-3">
        <SheetError message={error} />
        <StagePill subscription={current} />
        <div className="space-y-1">
          {current.accountNumber && <Row label="Smartcard / IUC" value={current.accountNumber} />}
          <Row label="Started" value={formatSubscriptionDate(current.startDate)} />
          <Row label="Ends" value={`${formatSubscriptionDate(current.endDate)} · ${daysLeftLabel(current.daysLeft)}`} />
          <Row label="Period" value={`${current.periodDays} days`} />
          {current.amountCents !== null && <Row label="Amount" value={money(current.amountCents)} />}
          {current.locationName && <Row label="Storefront" value={current.locationName} />}
        </div>

        <div className="border-t border-dashed border-navy/15 pt-3">
          <p className="mb-1.5 text-[10px] font-extrabold tracking-wide text-navy/50 uppercase">Reminders</p>
          <div className="space-y-1.5">
            {SUBSCRIPTION_NOTICE_STAGES.map((stage) => {
              const sent = current.notices.find((notice) => notice.stage === stage);
              const due = current.pendingNotice === stage;
              return (
                <div key={stage} className="flex items-center justify-between gap-2 rounded-lg border border-navy/10 px-3 py-2">
                  <span className="text-xs font-bold text-navy">{SUBSCRIPTION_NOTICE_LABELS[stage]}</span>
                  {sent ? (
                    <span className="text-right text-[11px] text-green">
                      Sent {new Date(sent.sentAt).toLocaleDateString()}
                      {sent.sentByName ? ` · ${sent.sentByName}` : ""}
                    </span>
                  ) : due && canEdit ? (
                    <button type="button" onClick={() => startSend(stage)} className="flex items-center gap-1 rounded-lg bg-red px-2.5 py-1.5 text-[11px] font-bold text-white">
                      <Send className="size-3.5" aria-hidden="true" />
                      Send
                    </button>
                  ) : (
                    <span className="text-[11px] text-navy/40">{due ? "Due now" : "Not sent"}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {current.status === "active" && canRenew && (
            <button type="button" onClick={startRenew} className="flex items-center justify-center gap-1.5 rounded-lg bg-navy py-2.5 text-xs font-bold text-white">
              <RefreshCcw className="size-4" aria-hidden="true" />
              Renew
            </button>
          )}
          {current.status === "active" && canEdit && (
            <button type="button" disabled={busy} onClick={() => void setStatus("cancelled")} className="flex items-center justify-center gap-1.5 rounded-lg border border-red/30 py-2.5 text-xs font-bold text-red disabled:opacity-50">
              <Ban className="size-4" aria-hidden="true" />
              Cancel
            </button>
          )}
          {current.status === "cancelled" && canEdit && (
            <button type="button" disabled={busy} onClick={() => void setStatus("active")} className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-navy/20 py-2.5 text-xs font-bold text-navy disabled:opacity-50">
              <RotateCcw className="size-4" aria-hidden="true" />
              Reactivate
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
