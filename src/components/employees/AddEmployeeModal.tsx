"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { type EmployeeAccessOptions, BranchSelect, RoleSelect } from "./access-options";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";
import { type EmployeeProfileDraft, EmployeeProfileFields, emptyProfileDraft, profileInputFrom } from "./EmployeeProfileFields";
import { PinInput } from "./PinInput";

/** Adds a staff member with what they need to log in — name, code, role, storefront, PIN — plus
 * optional details under "More details" (job, contacts, dates). Salary defaults and photo stay on
 * DESKTOP's full Employee form. */
export function AddEmployeeModal({
  options,
  onClose,
  onCreated,
}: {
  options: EmployeeAccessOptions;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [branchId, setBranchId] = useState<string | null>(options.branchScope);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [profile, setProfile] = useState<EmployeeProfileDraft>(emptyProfileDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (pin.length !== 6) return setError("PIN must be exactly 6 digits.");
    if (pin !== confirmPin) return setError("PIN and confirmation do not match.");
    setSaving(true);
    setError(null);
    try {
      await api.createEmployee({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        employeeCode: employeeCode.trim(),
        phone: phone.trim() || undefined,
        roleId,
        branchId: options.branchScope ?? branchId,
        pin,
        ...profileInputFrom(profile),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add employee.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="Add Employee" subtitle="They can log in with their code and PIN right away." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <SheetError message={error} />
        <div className="grid grid-cols-2 gap-3">
          <SheetField label="First name">
            <input autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={sheetInputClass} />
          </SheetField>
          <SheetField label="Last name">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className={sheetInputClass} />
          </SheetField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SheetField label="Employee code">
            <input
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
              placeholder="e.g. EMP-004"
              required
              className={sheetInputClass}
            />
          </SheetField>
          <SheetField label="Phone (optional)">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={sheetInputClass} />
          </SheetField>
        </div>
        <RoleSelect options={options} value={roleId} onChange={setRoleId} />
        <BranchSelect options={options} value={branchId} onChange={setBranchId} />
        <div className="grid grid-cols-2 gap-3">
          <SheetField label="PIN (6 digits)">
            <PinInput value={pin} onChange={setPin} />
          </SheetField>
          <SheetField label="Confirm PIN">
            <PinInput value={confirmPin} onChange={setConfirmPin} />
          </SheetField>
        </div>

        <button type="button" onClick={() => setShowMore((v) => !v)} className="flex items-center gap-1 text-xs font-bold text-blue">
          <ChevronDown className={`size-3.5 transition ${showMore ? "rotate-180" : ""}`} aria-hidden="true" />
          More details
        </button>
        {showMore && (
          <div className="space-y-3 rounded-lg bg-cream-dark/50 p-3">
            <SheetField label="Middle name">
              <input value={profile.middleName} onChange={(e) => setProfile((p) => ({ ...p, middleName: e.target.value }))} className={sheetInputClass} />
            </SheetField>
            <EmployeeProfileFields value={profile} onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))} />
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? "Adding…" : "Add Employee"}
        </button>
      </form>
    </BottomSheet>
  );
}
