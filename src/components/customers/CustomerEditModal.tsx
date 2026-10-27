"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { centsToPriceText, priceTextToCents } from "@/lib/money";
import type { MobileCustomerDetail } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";

const CUSTOMER_TYPES = [
  { value: "retail", label: "Retail" },
  { value: "wholesale", label: "Wholesale" },
  { value: "corporate", label: "Corporate" },
  { value: "walk_in", label: "Walk-In" },
  { value: "personal", label: "Personal" },
] as const;

/** Edit a customer's details and credit limit, or deactivate them — DESKTOP's customer form, same
 * fields and the same "phone must be unique" rule (SERVER enforces it). A credit limit is what the
 * dashboard's "over credit limit" warning checks against; blank = no limit. */
export function CustomerEditModal({ customerId, onClose, onSaved }: { customerId: string; onClose: () => void; onSaved: () => void }) {
  const [detail, setDetail] = useState<MobileCustomerDetail | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getCustomerDetail(customerId)
      .then((d) => {
        setDetail(d);
        setActive(d.status === "active");
        setForm({
          name: d.name,
          phone: d.phone,
          customerType: d.customerType,
          email: d.email ?? "",
          kraPin: d.kraPin ?? "",
          physicalAddress: d.physicalAddress ?? "",
          creditLimit: centsToPriceText(d.creditLimitCents),
          notes: d.notes ?? "",
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this customer."));
  }, [customerId]);

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const text = (key: string) => form[key]?.trim() || null;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateCustomer(customerId, {
        name: form.name!.trim(),
        phone: form.phone!.trim(),
        customerType: form.customerType as MobileCustomerDetail["customerType"],
        email: text("email"),
        kraPin: text("kraPin"),
        physicalAddress: text("physicalAddress"),
        creditLimitCents: form.creditLimit?.trim() ? priceTextToCents(form.creditLimit) : null,
        notes: text("notes"),
        status: active ? "active" : "inactive",
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="Edit Customer" subtitle={detail?.customerCode} onClose={onClose}>
      {!detail ? (
        error ? <SheetError message={error} /> : <p className="py-10 text-center text-sm text-navy/50">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <SheetError message={error} />
          <SheetField label="Name">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required className={sheetInputClass} />
          </SheetField>
          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Phone">
              <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} required className={sheetInputClass} />
            </SheetField>
            <SheetField label="Type">
              <select value={form.customerType} onChange={(e) => set("customerType", e.target.value)} className={sheetInputClass}>
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </SheetField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Credit limit">
              <input inputMode="decimal" value={form.creditLimit} onChange={(e) => set("creditLimit", e.target.value)} placeholder="No limit" className={sheetInputClass} />
            </SheetField>
            <SheetField label="KRA PIN">
              <input value={form.kraPin} onChange={(e) => set("kraPin", e.target.value.toUpperCase())} className={sheetInputClass} />
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
            Active (untick to hide this customer from pickers)
          </label>
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : "Save Customer"}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
