"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Employee, EmployeeStatusValue } from "@/lib/types";
import { type EmployeeAccessOptions, BranchSelect, RoleSelect } from "./access-options";
import { BottomSheet, SheetError } from "../BottomSheet";

const STATUS_CHOICES: Array<{ value: EmployeeStatusValue; label: string; hint: string }> = [
  { value: "active", label: "Active", hint: "Can log in and work as normal." },
  { value: "suspended", label: "Suspended", hint: "Blocked from logging in until reactivated." },
  { value: "terminated", label: "Terminated", hint: "Has left the business. Blocked permanently; records are kept." },
];

/** Role, storefront and status in one sheet. Only sends what actually changed, so a role-only edit
 * never touches status and vice versa. A suspension locks the employee out of this app on their very
 * next tap, and out of the POS at its next sync. */
export function ManageAccessModal({
  employee,
  options,
  onClose,
  onSaved,
}: {
  employee: Employee;
  options: EmployeeAccessOptions;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roleId, setRoleId] = useState(employee.roleId ?? "");
  const [branchId, setBranchId] = useState<string | null>(employee.branchId);
  const [status, setStatus] = useState<EmployeeStatusValue>((employee.status as EmployeeStatusValue) ?? "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const changes = {
      ...(roleId && roleId !== employee.roleId ? { roleId } : {}),
      ...(options.branchScope === null && branchId !== employee.branchId ? { branchId } : {}),
      ...(status !== employee.status ? { status } : {}),
    };
    if (Object.keys(changes).length === 0) return onClose();

    setSaving(true);
    setError(null);
    try {
      await api.updateEmployeeAccess(employee.id, changes);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update access.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="Manage Access" subtitle={`${employee.firstName} ${employee.lastName} · ${employee.employeeCode}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <SheetError message={error} />
        <RoleSelect options={options} value={roleId} onChange={setRoleId} />
        <BranchSelect options={options} value={branchId} onChange={setBranchId} />

        <fieldset>
          <legend className="text-[11px] font-semibold text-navy/50">System access</legend>
          <div className="mt-1 space-y-1.5">
            {STATUS_CHOICES.map((choice) => (
              <label
                key={choice.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 ${
                  status === choice.value ? "border-blue bg-blue/5" : "border-navy/15"
                }`}
              >
                <input
                  type="radio"
                  name="employee-status"
                  value={choice.value}
                  checked={status === choice.value}
                  onChange={() => setStatus(choice.value)}
                  className="mt-0.5 accent-blue"
                />
                <span>
                  <span className="block text-sm font-bold text-navy">{choice.label}</span>
                  <span className="block text-[11px] text-navy/50">{choice.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
