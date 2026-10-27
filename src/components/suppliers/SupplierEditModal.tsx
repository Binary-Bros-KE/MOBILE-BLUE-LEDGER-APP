"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { centsToPriceText, priceTextToCents } from "@/lib/money";
import type { MobileSupplierDetail } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
] as const;

/** Edit a supplier's details — contacts, how you pay them (M-Pesa or bank details shown for the
 * chosen option), credit limit — or deactivate them. DESKTOP's supplier form minus country/county/
 * website, which a mobile save leaves untouched. Name must stay unique (SERVER enforces). */
export function SupplierEditModal({ supplierId, onClose, onSaved }: { supplierId: string; onClose: () => void; onSaved: () => void }) {
  const [detail, setDetail] = useState<MobileSupplierDetail | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSupplierDetail(supplierId)
      .then((d) => {
        setDetail(d);
        setActive(d.status === "active");
        setForm({
          businessName: d.businessName,
          contactPerson: d.contactPerson ?? "",
          phone1: d.phone1,
          phone2: d.phone2 ?? "",
          email: d.email ?? "",
          kraPin: d.kraPin ?? "",
          town: d.town ?? "",
          physicalAddress: d.physicalAddress ?? "",
          paymentOption: d.paymentOption,
          mpesaName: d.mpesaName ?? "",
          mpesaNumber: d.mpesaNumber ?? "",
          bankName: d.bankName ?? "",
          bankAccountName: d.bankAccountName ?? "",
          bankAccountNumber: d.bankAccountNumber ?? "",
          creditLimit: centsToPriceText(d.creditLimitCents),
          notes: d.notes ?? "",
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this supplier."));
  }, [supplierId]);

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const text = (key: string) => form[key]?.trim() || null;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateSupplier(supplierId, {
        businessName: form.businessName!.trim(),
        contactPerson: text("contactPerson"),
        phone1: form.phone1!.trim(),
        phone2: text("phone2"),
        email: text("email"),
        kraPin: text("kraPin"),
        town: text("town"),
        physicalAddress: text("physicalAddress"),
        paymentOption: form.paymentOption as MobileSupplierDetail["paymentOption"],
        mpesaName: text("mpesaName"),
        mpesaNumber: text("mpesaNumber"),
        bankName: text("bankName"),
        bankAccountName: text("bankAccountName"),
        bankAccountNumber: text("bankAccountNumber"),
        creditLimitCents: form.creditLimit?.trim() ? priceTextToCents(form.creditLimit) : null,
        notes: text("notes"),
        status: active ? "active" : "inactive",
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save supplier.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="Edit Supplier" subtitle={detail?.supplierCode} onClose={onClose}>
      {!detail ? (
        error ? <SheetError message={error} /> : <p className="py-10 text-center text-sm text-navy/50">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <SheetError message={error} />
          <SheetField label="Business name">
            <input value={form.businessName} onChange={(e) => set("businessName", e.target.value)} required className={sheetInputClass} />
          </SheetField>
          <SheetField label="Contact person">
            <input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} className={sheetInputClass} />
          </SheetField>
          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Phone">
              <input type="tel" value={form.phone1} onChange={(e) => set("phone1", e.target.value)} required className={sheetInputClass} />
            </SheetField>
            <SheetField label="Other phone">
              <input type="tel" value={form.phone2} onChange={(e) => set("phone2", e.target.value)} className={sheetInputClass} />
            </SheetField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SheetField label="We pay them by">
              <select value={form.paymentOption} onChange={(e) => set("paymentOption", e.target.value)} className={sheetInputClass}>
                {PAYMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </SheetField>
            <SheetField label="Credit limit">
              <input inputMode="decimal" value={form.creditLimit} onChange={(e) => set("creditLimit", e.target.value)} placeholder="No limit" className={sheetInputClass} />
            </SheetField>
          </div>
          {form.paymentOption === "mpesa" && (
            <div className="grid grid-cols-2 gap-3">
              <SheetField label="M-Pesa name">
                <input value={form.mpesaName} onChange={(e) => set("mpesaName", e.target.value)} className={sheetInputClass} />
              </SheetField>
              <SheetField label="M-Pesa number">
                <input type="tel" value={form.mpesaNumber} onChange={(e) => set("mpesaNumber", e.target.value)} className={sheetInputClass} />
              </SheetField>
            </div>
          )}
          {form.paymentOption === "bank_transfer" && (
            <>
              <SheetField label="Bank">
                <input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} className={sheetInputClass} />
              </SheetField>
              <div className="grid grid-cols-2 gap-3">
                <SheetField label="Account name">
                  <input value={form.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} className={sheetInputClass} />
                </SheetField>
                <SheetField label="Account number">
                  <input value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} className={sheetInputClass} />
                </SheetField>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <SheetField label="KRA PIN">
              <input value={form.kraPin} onChange={(e) => set("kraPin", e.target.value.toUpperCase())} className={sheetInputClass} />
            </SheetField>
            <SheetField label="Town">
              <input value={form.town} onChange={(e) => set("town", e.target.value)} className={sheetInputClass} />
            </SheetField>
          </div>
          <SheetField label="Email">
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={sheetInputClass} />
          </SheetField>
          <SheetField label="Address">
            <input value={form.physicalAddress} onChange={(e) => set("physicalAddress", e.target.value)} className={sheetInputClass} />
          </SheetField>
          <SheetField label="Notes">
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={sheetInputClass} />
          </SheetField>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-blue" />
            Active (untick to hide this supplier from pickers)
          </label>
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : "Save Supplier"}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
