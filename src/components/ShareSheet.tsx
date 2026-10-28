"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { EA_COUNTRY_CODES, normalizePhoneForWhatsApp } from "@/lib/phone";
import { getIncludeWhatsappPreview, setIncludeWhatsappPreview } from "@/lib/share-preferences";
import type { ShareDocumentEntity } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "./BottomSheet";

type Channel = "whatsapp" | "email";
const CUSTOM_COUNTRY = "custom";

/**
 * Share a document straight to the customer — ported from DESKTOP's ShareModal. The OS share sheet
 * alone only reaches contacts saved on THIS phone, and most customers aren't; here the customer's
 * phone/email is pre-filled from their record (mobile /share-recipient — never part of the public
 * share page) or typed in, and WhatsApp / the email app opens already addressed with the message.
 *
 * Neither channel can attach a file — the message carries a link to the shared document, same as
 * DESKTOP. "Other apps" keeps the native share sheet for anything else (SMS, Telegram, …).
 *
 * `deliveryEntity` (a sale/quotation with a delivery note attached) offers "Include delivery note",
 * appending the note's own link — same as DESKTOP.
 */
export function ShareSheet({
  entity,
  entityId,
  documentLabel,
  deliveryEntity,
  onClose,
}: {
  entity: ShareDocumentEntity;
  entityId: string;
  documentLabel: string;
  deliveryEntity?: ShareDocumentEntity;
  onClose: () => void;
}) {
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [countryCode, setCountryCode] = useState<string>(EA_COUNTRY_CODES[0].code);
  const [customCode, setCustomCode] = useState("");
  const [contact, setContact] = useState<{ name: string | null; phone: string; email: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [includePreview, setIncludePreview] = useState(() => getIncludeWhatsappPreview());
  const [includeDelivery, setIncludeDelivery] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getShareRecipient(entity, entityId)
      .then((recipient) => {
        if (cancelled) return;
        setContact({ name: recipient.name, phone: recipient.phone ?? "", email: recipient.email ?? "" });
        // Only fill what the user hasn't started typing themselves.
        setPhone((current) => current || recipient.phone || "");
        setEmail((current) => current || recipient.email || "");
      })
      .catch(() => {
        // No pre-fill — the user just types the number/address.
      });
    return () => {
      cancelled = true;
    };
  }, [entity, entityId]);

  function handleIncludePreviewChange(next: boolean): void {
    setIncludePreview(next);
    setIncludeWhatsappPreview(next);
  }

  /** The document's link message, plus the delivery note's own when that's included. */
  async function buildMessage(): Promise<{ message: string }> {
    const primary = await api.createShareLink(entity, entityId, includePreview);
    if (deliveryEntity && includeDelivery) {
      const delivery = await api.createShareLink(deliveryEntity, entityId, includePreview);
      return { message: `${primary.message}\n\n${delivery.message}` };
    }
    return primary;
  }

  const recipient = channel === "whatsapp" ? phone : email;
  const effectiveCode = countryCode === CUSTOM_COUNTRY ? customCode : countryCode;
  const canSend = recipient.trim() !== "" && !(channel === "whatsapp" && countryCode === CUSTOM_COUNTRY && !customCode.trim());

  async function handleSend(): Promise<void> {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const { message } = await buildMessage();
      if (channel === "whatsapp") {
        const digits = normalizePhoneForWhatsApp(phone, effectiveCode);
        // WhatsApp's own scheme opens the app (WhatsApp or WhatsApp Business) directly — a wa.me web
        // link can stop on a "Continue to chat" page in a browser tab first. Same default as DESKTOP.
        window.location.href = `whatsapp://send?phone=${digits}&text=${encodeURIComponent(message)}`;
      } else {
        window.location.href = `mailto:${email.trim()}?subject=${encodeURIComponent(documentLabel)}&body=${encodeURIComponent(message)}`;
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't prepare this share.");
    } finally {
      setSending(false);
    }
  }

  async function handleOtherApps(): Promise<void> {
    setSending(true);
    setError(null);
    try {
      const { message } = await buildMessage();
      if (navigator.share) {
        await navigator.share({ title: documentLabel, text: message });
      } else {
        await navigator.clipboard.writeText(message);
        setError("Copied to clipboard — paste it anywhere to share.");
        return;
      }
      onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return; // share sheet dismissed
      setError(err instanceof ApiError ? err.message : "Couldn't prepare this share.");
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet title="Share" subtitle={contact?.name ? `Send ${documentLabel} to ${contact.name}.` : `Send ${documentLabel}.`} onClose={onClose}>
      <div className="space-y-3">
        <SheetError message={error} />

        <div className="grid grid-cols-2 gap-2">
          <ChannelButton active={channel === "whatsapp"} onClick={() => setChannel("whatsapp")} icon={<MessageCircle className="size-5" aria-hidden="true" />} label="WhatsApp" />
          <ChannelButton active={channel === "email"} onClick={() => setChannel("email")} icon={<Mail className="size-5" aria-hidden="true" />} label="Email" />
        </div>

        {channel === "whatsapp" ? (
          <>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
              <SheetField label="Country">
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className={sheetInputClass}>
                  {EA_COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label} (+{c.code})
                    </option>
                  ))}
                  <option value={CUSTOM_COUNTRY}>Custom…</option>
                </select>
              </SheetField>
              <SheetField label="Phone number">
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0791880000" className={sheetInputClass} />
              </SheetField>
            </div>
            {countryCode === CUSTOM_COUNTRY && (
              <SheetField label="Country code">
                <input inputMode="numeric" value={customCode} onChange={(e) => setCustomCode(e.target.value)} placeholder="e.g. 44 for the UK" className={sheetInputClass} />
              </SheetField>
            )}
          </>
        ) : (
          <SheetField label="Email address">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. customer@email.com" className={sheetInputClass} />
          </SheetField>
        )}

        <CheckboxRow label="Include WhatsApp preview" checked={includePreview} onChange={handleIncludePreviewChange} />
        {deliveryEntity && <CheckboxRow label="Include delivery note" checked={includeDelivery} onChange={setIncludeDelivery} />}

        <p className="text-[11px] text-navy/50">
          {channel === "whatsapp"
            ? "Opens WhatsApp on this number with the message and a link to view/download the document."
            : "Opens your email app with the message and link filled in."}
        </p>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || !canSend}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {sending ? "Preparing link…" : `Send via ${channel === "whatsapp" ? "WhatsApp" : "Email"}`}
        </button>
        <button
          type="button"
          onClick={() => void handleOtherApps()}
          disabled={sending}
          className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-bold text-navy/50 disabled:opacity-50"
        >
          <Share2 className="size-3.5" aria-hidden="true" />
          Other apps…
        </button>
      </div>
    </BottomSheet>
  );
}

function ChannelButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-bold transition ${
        active ? "border-blue bg-blue/10 text-blue" : "border-navy/15 bg-cream-dark/40 text-navy"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-navy/10 bg-cream-dark/40 px-3 py-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-blue" />
      <span className="text-xs font-bold text-navy">{label}</span>
    </label>
  );
}
