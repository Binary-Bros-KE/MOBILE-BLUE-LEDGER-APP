"use client";

import type { MobileLocation, MobileRole } from "@/lib/types";
import { SheetField, sheetInputClass } from "../BottomSheet";

/** What the Add employee / Manage access sheets need to render their pickers — loaded once by
 * EmployeesTab and passed down. `branchScope` is the viewer's own storefront when they're
 * branch-scoped (non-Super-Admin with a branch), same rule SERVER's mobile-employees-service.ts
 * enforces: they can only assign staff to that storefront, never elsewhere or to "All Storefronts". */
export type EmployeeAccessOptions = {
  roles: MobileRole[];
  locations: MobileLocation[];
  viewerIsSuperAdmin: boolean;
  branchScope: string | null;
};

/** "All Storefronts" — a branch-less employee (Super Admin-style cross-storefront visibility). */
const NO_BRANCH = "";

export function RoleSelect({ options, value, onChange }: { options: EmployeeAccessOptions; value: string; onChange: (roleId: string) => void }) {
  // A non-Super-Admin can never grant the Super Admin role — hidden here, rejected by SERVER anyway.
  const roles = options.roles.filter((r) => options.viewerIsSuperAdmin || !r.isSuperAdmin);
  return (
    <SheetField label="Role">
      <select value={value} onChange={(e) => onChange(e.target.value)} required className={sheetInputClass}>
        <option value="" disabled>
          Choose a role
        </option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.roleName}
          </option>
        ))}
      </select>
    </SheetField>
  );
}

export function BranchSelect({
  options,
  value,
  onChange,
}: {
  options: EmployeeAccessOptions;
  value: string | null;
  onChange: (branchId: string | null) => void;
}) {
  return (
    <SheetField label="Storefront">
      <select
        value={options.branchScope ?? value ?? NO_BRANCH}
        onChange={(e) => onChange(e.target.value === NO_BRANCH ? null : e.target.value)}
        disabled={options.branchScope !== null}
        className={sheetInputClass}
      >
        <option value={NO_BRANCH}>All Storefronts</option>
        {options.locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.locationName}
          </option>
        ))}
      </select>
    </SheetField>
  );
}
