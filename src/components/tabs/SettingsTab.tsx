"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, ChevronRight, CreditCard, Loader2, Plus, Receipt } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MobileBusinessProfile, MobilePaymentMethodAdmin, MobileSettings, MobileStorefrontDetails } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";

/**
 * Business Profile, each storefront's receipt details, and payment methods — the day-to-day subset
 * of DESKTOP's own settings screens, each section gated by the same module DESKTOP uses
 * (business_profile / locations / payment_methods, "edit"). Profile changes reach every desktop on
 * its next heartbeat; storefront and payment-method changes on its next sync.
 */
export function SettingsTab({
  canEditProfile,
  canEditStorefronts,
  canCreatePaymentMethod,
  canEditPaymentMethods,
}: {
  canEditProfile: boolean;
  canEditStorefronts: boolean;
  canCreatePaymentMethod: boolean;
  canEditPaymentMethods: boolean;
}) {
  const [settings, setSettings] = useState<MobileSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ kind: "profile" } | { kind: "storefront"; storefront: MobileStorefrontDetails } | { kind: "newMethod" } | null>(null);
  const [busyMethodId, setBusyMethodId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load settings."));
  }, []);

  useEffect(load, [load]);

  function saved(message: string): void {
    setSheet(null);
    setNotice(message);
    load();
  }

  async function toggleMethod(method: MobilePaymentMethodAdmin, change: { isActive?: boolean; requiresReference?: boolean }): Promise<void> {
    setBusyMethodId(method.id);
    setError(null);
    try {
      await api.updatePaymentMethod(method.id, change);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update payment method.");
    } finally {
      setBusyMethodId(null);
    }
  }

  if (!settings) {
    return (
      <div className="px-4 py-4">
        {error ? <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div> : <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
      </div>
    );
  }

  const { profile } = settings;

  return (
    <div className="space-y-4 px-4 py-4 pb-10">
      {notice && <div className="rounded border border-green/30 bg-green/10 px-4 py-3 text-sm font-semibold text-green">{notice}</div>}
      {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}

      <Section icon={Building2} title="Business Profile">
        <div className="space-y-0.5 text-xs text-navy/70">
          <p className="text-sm font-bold text-navy">{profile.businessName}</p>
          {profile.contactPhone && <p>{profile.contactPhone}</p>}
          {profile.email && <p>{profile.email}</p>}
          {profile.physicalAddress && <p>{profile.physicalAddress}</p>}
          {profile.kraPin && <p>KRA PIN: {profile.kraPin}</p>}
          <p>
            VAT {profile.vatRatePercent}% · prices {profile.pricesTaxInclusive ? "include" : "exclude"} tax
          </p>
        </div>
        {canEditProfile && <RowButton label="Edit business profile" onClick={() => setSheet({ kind: "profile" })} />}
      </Section>

      <Section icon={Receipt} title="Storefront Receipts">
        <div className="divide-y divide-navy/10">
          {settings.storefronts.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={!canEditStorefronts}
              onClick={() => setSheet({ kind: "storefront", storefront: s })}
              className="flex w-full items-center justify-between gap-2 py-2.5 text-left disabled:cursor-default"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-navy">{s.locationName}</span>
                <span className="block truncate text-[11px] text-navy/50">{s.receiptFooter || s.phone || "No receipt details yet"}</span>
              </span>
              {canEditStorefronts && <ChevronRight className="size-4 flex-none text-navy/30" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Section>

      <Section icon={CreditCard} title="Payment Methods">
        <div className="divide-y divide-navy/10">
          {settings.paymentMethods.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-bold ${m.isActive ? "text-navy" : "text-navy/40"}`}>{m.name}</p>
                {canEditPaymentMethods ? (
                  <label className="mt-0.5 flex items-center gap-1.5 text-[11px] text-navy/50">
                    <input
                      type="checkbox"
                      checked={m.requiresReference}
                      disabled={busyMethodId === m.id}
                      onChange={(e) => void toggleMethod(m, { requiresReference: e.target.checked })}
                      className="size-3.5 accent-blue"
                    />
                    Needs a reference (e.g. M-Pesa code)
                  </label>
                ) : (
                  m.requiresReference && <p className="text-[11px] text-navy/50">Needs a reference</p>
                )}
              </div>
              {busyMethodId === m.id ? (
                <Loader2 className="size-4 animate-spin text-navy/40" aria-hidden="true" />
              ) : (
                canEditPaymentMethods && (
                  <button
                    type="button"
                    onClick={() => void toggleMethod(m, { isActive: !m.isActive })}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${m.isActive ? "bg-green/15 text-green" : "bg-navy/10 text-navy/50"}`}
                  >
                    {m.isActive ? "On" : "Off"}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
        {canCreatePaymentMethod && (
          <button type="button" onClick={() => setSheet({ kind: "newMethod" })} className="mt-2 flex items-center gap-1 text-xs font-bold text-blue">
            <Plus className="size-3.5" aria-hidden="true" />
            Add payment method
          </button>
        )}
      </Section>

      {sheet?.kind === "profile" && <ProfileSheet profile={profile} onClose={() => setSheet(null)} onSaved={() => saved("Business profile saved.")} />}
      {sheet?.kind === "storefront" && (
        <StorefrontSheet storefront={sheet.storefront} onClose={() => setSheet(null)} onSaved={() => saved(`${sheet.storefront.locationName} receipt details saved.`)} />
      )}
      {sheet?.kind === "newMethod" && <NewPaymentMethodSheet onClose={() => setSheet(null)} onSaved={() => saved("Payment method added.")} />}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-navy/50 uppercase">
        <Icon className="size-3.5" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function RowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-3 flex w-full items-center justify-between border-t border-navy/10 pt-3 text-xs font-bold text-blue">
      {label}
      <ChevronRight className="size-4" aria-hidden="true" />
    </button>
  );
}

function SaveButton({ saving, label }: { saving: boolean; label: string }) {
  return (
    <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50">
      {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {saving ? "Saving…" : label}
    </button>
  );
}

/** Shared submit plumbing for the three sheets below. */
function useSave(onSaved: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<unknown>): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await action();
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }
  return { saving, error, setError, run };
}

function ProfileSheet({ profile, onClose, onSaved }: { profile: MobileBusinessProfile; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    businessName: profile.businessName,
    contactPhone: profile.contactPhone ?? "",
    alternativePhone: profile.alternativePhone ?? "",
    email: profile.email ?? "",
    website: profile.website ?? "",
    kraPin: profile.kraPin ?? "",
    cityTown: profile.cityTown ?? "",
    physicalAddress: profile.physicalAddress ?? "",
    vatRatePercent: String(profile.vatRatePercent),
    pricesTaxInclusive: profile.pricesTaxInclusive,
  });
  const { saving, error, setError, run } = useSave(onSaved);
  const set = (key: keyof typeof form, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }));
  const taxChanged = Number(form.vatRatePercent) !== profile.vatRatePercent || form.pricesTaxInclusive !== profile.pricesTaxInclusive;

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const vat = Number.parseFloat(form.vatRatePercent);
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) return setError("VAT rate must be between 0 and 100.");
    const text = (v: string) => v.trim() || null;
    void run(() =>
      api.updateBusinessProfile({
        businessName: form.businessName.trim(),
        contactPhone: text(form.contactPhone),
        alternativePhone: text(form.alternativePhone),
        email: text(form.email),
        website: text(form.website),
        kraPin: text(form.kraPin),
        cityTown: text(form.cityTown),
        physicalAddress: text(form.physicalAddress),
        vatRatePercent: vat,
        pricesTaxInclusive: form.pricesTaxInclusive,
      }),
    );
  }

  return (
    <BottomSheet title="Business Profile" subtitle="Shown on receipts, invoices and quotations." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <SheetError message={error} />
        <SheetField label="Business name">
          <input value={form.businessName} onChange={(e) => set("businessName", e.target.value)} required className={sheetInputClass} />
        </SheetField>
        <div className="grid grid-cols-2 gap-3">
          <SheetField label="Phone">
            <input type="tel" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} className={sheetInputClass} />
          </SheetField>
          <SheetField label="Other phone">
            <input type="tel" value={form.alternativePhone} onChange={(e) => set("alternativePhone", e.target.value)} className={sheetInputClass} />
          </SheetField>
        </div>
        <SheetField label="Email">
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={sheetInputClass} />
        </SheetField>
        <div className="grid grid-cols-2 gap-3">
          <SheetField label="KRA PIN">
            <input value={form.kraPin} onChange={(e) => set("kraPin", e.target.value.toUpperCase())} className={sheetInputClass} />
          </SheetField>
          <SheetField label="Town">
            <input value={form.cityTown} onChange={(e) => set("cityTown", e.target.value)} className={sheetInputClass} />
          </SheetField>
        </div>
        <SheetField label="Physical address">
          <input value={form.physicalAddress} onChange={(e) => set("physicalAddress", e.target.value)} className={sheetInputClass} />
        </SheetField>
        <SheetField label="Website">
          <input value={form.website} onChange={(e) => set("website", e.target.value)} className={sheetInputClass} />
        </SheetField>
        <div className="grid grid-cols-2 items-end gap-3">
          <SheetField label="VAT rate (%)">
            <input inputMode="decimal" value={form.vatRatePercent} onChange={(e) => set("vatRatePercent", e.target.value)} className={sheetInputClass} />
          </SheetField>
          <label className="flex h-[38px] items-center gap-2 text-sm font-semibold text-navy">
            <input type="checkbox" checked={form.pricesTaxInclusive} onChange={(e) => set("pricesTaxInclusive", e.target.checked)} className="size-4 accent-blue" />
            Prices include tax
          </label>
        </div>
        {taxChanged && (
          <p className="rounded border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold-text">
            Changing tax settings changes how every new sale is priced. Past sales are not changed.
          </p>
        )}
        <SaveButton saving={saving} label="Save Profile" />
      </form>
    </BottomSheet>
  );
}

function StorefrontSheet({ storefront, onClose, onSaved }: { storefront: MobileStorefrontDetails; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    phone: storefront.phone ?? "",
    email: storefront.email ?? "",
    physicalAddress: storefront.physicalAddress ?? "",
    receiptHeader: storefront.receiptHeader ?? "",
    receiptFooter: storefront.receiptFooter ?? "",
  });
  const { saving, error, run } = useSave(onSaved);
  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const text = (v: string) => v.trim() || null;
    void run(() =>
      api.updateStorefrontDetails(storefront.id, {
        phone: text(form.phone),
        email: text(form.email),
        physicalAddress: text(form.physicalAddress),
        receiptHeader: text(form.receiptHeader),
        receiptFooter: text(form.receiptFooter),
      }),
    );
  }

  return (
    <BottomSheet title={storefront.locationName} subtitle="Printed on this storefront's receipts." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <SheetError message={error} />
        <div className="grid grid-cols-2 gap-3">
          <SheetField label="Phone">
            <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={sheetInputClass} />
          </SheetField>
          <SheetField label="Email">
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={sheetInputClass} />
          </SheetField>
        </div>
        <SheetField label="Address">
          <input value={form.physicalAddress} onChange={(e) => set("physicalAddress", e.target.value)} className={sheetInputClass} />
        </SheetField>
        <SheetField label="Receipt header">
          <textarea value={form.receiptHeader} onChange={(e) => set("receiptHeader", e.target.value)} rows={2} placeholder="e.g. Welcome to our shop" className={sheetInputClass} />
        </SheetField>
        <SheetField label="Receipt footer">
          <textarea value={form.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value)} rows={2} placeholder="e.g. Goods once sold are not returnable" className={sheetInputClass} />
        </SheetField>
        <SaveButton saving={saving} label="Save" />
      </form>
    </BottomSheet>
  );
}

function NewPaymentMethodSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [requiresReference, setRequiresReference] = useState(false);
  const { saving, error, run } = useSave(onSaved);

  return (
    <BottomSheet title="Add Payment Method" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => api.createPaymentMethod({ name: name.trim(), requiresReference }));
        }}
        className="space-y-3"
      >
        <SheetError message={error} />
        <SheetField label="Name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Equity Bank, Airtel Money" required className={sheetInputClass} />
        </SheetField>
        <label className="flex items-center gap-2 text-sm font-semibold text-navy">
          <input type="checkbox" checked={requiresReference} onChange={(e) => setRequiresReference(e.target.checked)} className="size-4 accent-blue" />
          Needs a reference (transaction code)
        </label>
        <SaveButton saving={saving} label="Add" />
      </form>
    </BottomSheet>
  );
}
