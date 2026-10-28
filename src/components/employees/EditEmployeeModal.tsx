"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Employee } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { type EmployeeProfileDraft, EmployeeProfileFields, profileDraftFrom, profileInputFrom } from "./EmployeeProfileFields";

/** Edit an employee's details — name, code, contacts, job and dates (DESKTOP's Employee form minus
 * photo and salary defaults). Role, storefront and status live in Manage Access; PIN in Reset PIN.
 * A changed code is their new login code right away. */
export function EditEmployeeModal({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => void }) {
  const [firstName, setFirstName] = useState(employee.firstName);
  const [lastName, setLastName] = useState(employee.lastName);
  const [employeeCode, setEmployeeCode] = useState(employee.employeeCode);
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [profile, setProfile] = useState<EmployeeProfileDraft>(() => profileDraftFrom(employee));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateEmployeeDetails(employee.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        employeeCode: employeeCode.trim(),
        phone: phone.trim() || null,
        ...profileInputFrom(profile),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save employee details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="Edit Details" subtitle={`${employee.firstName} ${employee.lastName} · ${employee.employeeCode}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <SheetError message={error} />
        <div className="grid grid-cols-2 gap-3">
          <SheetField label="First name">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={sheetInputClass} />
          </SheetField>
          <SheetField label="Middle name">
            <input value={profile.middleName} onChange={(e) => setProfile((p) => ({ ...p, middleName: e.target.value }))} className={sheetInputClass} />
          </SheetField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SheetField label="Last name">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className={sheetInputClass} />
          </SheetField>
          <SheetField label="Employee code">
            <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())} required className={sheetInputClass} />
          </SheetField>
        </div>
        <SheetField label="Phone">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={sheetInputClass} />
        </SheetField>
        <EmployeeProfileFields value={profile} onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))} />
        {employeeCode.trim().toUpperCase() !== employee.employeeCode && (
          <p className="rounded border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold-text">
            They&apos;ll sign in with {employeeCode.trim().toUpperCase() || "the new code"} from now on.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </BottomSheet>
  );
}
