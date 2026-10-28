"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, KeyRound, Loader2, Mail, Pencil, Phone, ShieldCheck, Store, UserCheck, UserX } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { Employee, Salary } from "@/lib/types";
import { PayslipModal } from "./PayslipModal";
import type { EmployeeAccessOptions } from "./employees/access-options";
import { ChangePinModal } from "./employees/ChangePinModal";
import { EditEmployeeModal } from "./employees/EditEmployeeModal";
import { ManageAccessModal } from "./employees/ManageAccessModal";

const STATUS_TONE: Record<string, string> = {
  active: "border-green text-green",
  suspended: "border-red text-red",
  terminated: "border-navy/30 text-navy/50",
  inactive: "border-navy/30 text-navy/50",
};

/** `accessOptions` is null when the viewer can't manage this employee's access at all (no
 * employees.edit, or the target is a Super Admin and the viewer isn't) — the card then only offers
 * "Change My PIN" on the viewer's own card. SERVER enforces the same rules regardless. */
export function EmployeeCard({
  employee,
  currency,
  isSelf,
  accessOptions,
  onChanged,
}: {
  employee: Employee;
  currency: string;
  isSelf: boolean;
  accessOptions: EmployeeAccessOptions | null;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [salaries, setSalaries] = useState<Salary[] | null>(null);
  const [loadingSalaries, setLoadingSalaries] = useState(false);
  const [salariesError, setSalariesError] = useState<string | null>(null);
  const [selectedSalary, setSelectedSalary] = useState<Salary | null>(null);
  const [sheet, setSheet] = useState<"pin" | "access" | "details" | null>(null);
  const [confirmingToggle, setConfirmingToggle] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Own card: PIN only (SERVER blocks changing your own status/role — no self-lockout from a phone).
  const canManageAccess = accessOptions !== null && !isSelf;
  const canChangePin = isSelf || canManageAccess;
  // Details (unlike status/role) are fine to edit on your own card too — same employees.edit grant.
  const canEditDetails = accessOptions !== null;
  const isActive = employee.status === "active";

  /** Two taps (arm, then confirm) rather than a native confirm() — a suspension is instant and the
   * whole point of the button is speed, but a single stray tap shouldn't lock someone out. */
  async function handleQuickToggle(): Promise<void> {
    if (!confirmingToggle) {
      setConfirmingToggle(true);
      return;
    }
    setToggling(true);
    setAccessError(null);
    try {
      await api.updateEmployeeAccess(employee.id, { status: isActive ? "suspended" : "active" });
      setConfirmingToggle(false);
      onChanged();
    } catch (err) {
      setAccessError(err instanceof ApiError ? err.message : "Could not update access.");
    } finally {
      setToggling(false);
    }
  }

  const fullName = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ");
  const statusTone = STATUS_TONE[employee.status] ?? "border-navy/30 text-navy/50";

  async function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && salaries === null) {
      setLoadingSalaries(true);
      setSalariesError(null);
      try {
        setSalaries(await api.getEmployeeSalaries(employee.id));
      } catch (err) {
        setSalariesError(err instanceof ApiError ? err.message : "Could not load salary history.");
      } finally {
        setLoadingSalaries(false);
      }
    }
  }

  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-sm">
      <button type="button" onClick={() => void handleToggle()} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="grid size-11 flex-none place-items-center rounded-full bg-navy font-display text-sm text-white">
          {employee.firstName.charAt(0)}
          {employee.lastName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-navy">{fullName}</p>
          <p className="truncate text-xs text-navy/50">
            {employee.employeeCode}
            {employee.roleName ? ` · ${employee.roleName}` : ""}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-bold text-blue">
            <Store className="size-3.5 flex-none" aria-hidden="true" />
            {employee.branchName ?? "All Storefronts"}
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${statusTone}`}>
          {employee.status}
        </span>
        <ChevronDown className={`size-4 flex-none text-navy/40 transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-dashed border-navy/15 px-4 pb-4 pt-3">
              <div className="flex flex-wrap gap-2">
                {employee.roleName && <Pill label="Role" value={employee.roleName} />}
                {employee.branchName && <Pill label="Branch" value={employee.branchName} />}
                {employee.department && <Pill label="Dept" value={employee.department} />}
                {employee.jobTitle && <Pill label="Title" value={employee.jobTitle} />}
              </div>

              <div className="space-y-1.5 text-xs">
                {employee.phone && <InfoRow icon={Phone} value={employee.phone} />}
                {employee.email && <InfoRow icon={Mail} value={employee.email} />}
                {employee.branchName && <InfoRow icon={Store} value={employee.branchName} />}
                <InfoRow label="Gender" value={employee.gender} />
                <InfoRow label="Date of birth" value={employee.dateOfBirth} />
                <InfoRow label="Hire date" value={employee.hireDate} />
                <InfoRow label="Alternative phone" value={employee.alternativePhone} />
              </div>

              {canEditDetails && (
                <button
                  type="button"
                  onClick={() => setSheet("details")}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-navy/15 py-2.5 text-xs font-bold text-navy hover:bg-cream-dark"
                >
                  <Pencil className="size-3.5 text-navy/50" aria-hidden="true" />
                  Edit Details
                </button>
              )}

              {canChangePin && (
                <div className="border-t border-dashed border-navy/15 pt-3">
                  <p className="mb-2 text-[11px] font-extrabold tracking-wide text-navy/40 uppercase">System Access</p>
                  {accessError && <p className="mb-2 text-xs font-semibold text-red">{accessError}</p>}
                  {accessNotice && <p className="mb-2 text-xs font-semibold text-green">{accessNotice}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <AccessButton icon={KeyRound} label={isSelf ? "Change My PIN" : "Reset PIN"} onClick={() => setSheet("pin")} />
                    {canManageAccess && <AccessButton icon={ShieldCheck} label="Manage Access" onClick={() => setSheet("access")} />}
                    {canManageAccess && (
                      <button
                        type="button"
                        disabled={toggling}
                        onClick={() => void handleQuickToggle()}
                        onBlur={() => setConfirmingToggle(false)}
                        className={`col-span-2 flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-bold disabled:opacity-50 ${
                          confirmingToggle
                            ? isActive
                              ? "border-red bg-red text-white"
                              : "border-green bg-green text-white"
                            : isActive
                              ? "border-red/40 text-red"
                              : "border-green/50 text-green"
                        }`}
                      >
                        {toggling ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : isActive ? (
                          <UserX className="size-3.5" aria-hidden="true" />
                        ) : (
                          <UserCheck className="size-3.5" aria-hidden="true" />
                        )}
                        {confirmingToggle ? "Tap again to confirm" : isActive ? "Suspend Access" : "Reactivate Access"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-dashed border-navy/15 pt-3">
                <p className="mb-2 text-[11px] font-extrabold tracking-wide text-navy/40 uppercase">Salary History</p>

                {loadingSalaries && <p className="py-4 text-center text-xs text-navy/40">Loading…</p>}
                {salariesError && <p className="text-xs font-semibold text-red">{salariesError}</p>}

                {salaries && salaries.length === 0 && (
                  <p className="py-4 text-center text-xs text-navy/40">No salary records yet.</p>
                )}

                {salaries && salaries.length > 0 && (
                  <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                    {salaries.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSalary(s)}
                        className="flex w-full items-center justify-between rounded-md border border-navy/10 px-3 py-2 text-left text-xs hover:bg-cream-dark"
                      >
                        <span>
                          <span className="block font-bold text-navy">{s.payPeriod}</span>
                          <span className="text-navy/40">{s.payslipNumber}</span>
                        </span>
                        <span className="font-semibold text-navy">{formatCents(s.netPayCents, currency)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {sheet === "pin" && (
        <ChangePinModal
          employee={employee}
          isSelf={isSelf}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            setAccessNotice(isSelf ? "Your PIN was changed." : "PIN reset — share the new PIN with them privately.");
          }}
        />
      )}
      {sheet === "details" && (
        <EditEmployeeModal
          employee={employee}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            onChanged();
          }}
        />
      )}
      {sheet === "access" && accessOptions && (
        <ManageAccessModal
          employee={employee}
          options={accessOptions}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            onChanged();
          }}
        />
      )}

      {selectedSalary && (
        <PayslipModal salary={selectedSalary} currency={currency} onClose={() => setSelectedSalary(null)} />
      )}
    </section>
  );
}

function AccessButton({ icon: Icon, label, onClick }: { icon: typeof Phone; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-lg border border-navy/15 py-2.5 text-xs font-bold text-navy hover:bg-cream-dark"
    >
      <Icon className="size-3.5 text-navy/50" aria-hidden="true" />
      {label}
    </button>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-dashed border-navy/25 bg-cream-dark/60 px-2.5 py-1 text-[11px] font-bold text-navy/70">
      {label}: {value}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon?: typeof Phone; label?: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-navy/70">
      {Icon && <Icon className="size-3.5 flex-none text-navy/40" aria-hidden="true" />}
      {label && <span className="text-navy/40">{label}:</span>}
      <span className="truncate">{value}</span>
    </div>
  );
}
