"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Employee } from "@/lib/types";
import { EmployeeCard } from "../EmployeeCard";
import { FilterChip } from "../FilterChip";
import type { EmployeeAccessOptions } from "../employees/access-options";
import { AddEmployeeModal } from "../employees/AddEmployeeModal";

const ALL_FILTER = "__all__";
// A distinct bucket from ALL_FILTER — this one narrows down to employees with no single assigned
// storefront (branchName null), not "don't filter at all".
const NO_BRANCH_FILTER = "__no_branch__";

/** Directory + system-access management (add staff, reset PINs, suspend/reactivate, change role or
 * storefront). `canCreate`/`canEdit` are the viewer's employees.create/edit grants — the same
 * actions DESKTOP's own Employees screen checks. */
export function EmployeesTab({
  currency,
  currentEmployeeId,
  viewerIsSuperAdmin,
  viewerBranchId,
  canCreate,
  canEdit,
}: {
  currency: string;
  currentEmployeeId: string | null;
  viewerIsSuperAdmin: boolean;
  viewerBranchId: string | null;
  canCreate: boolean;
  canEdit: boolean;
}) {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState(ALL_FILTER);
  const [accessOptions, setAccessOptions] = useState<EmployeeAccessOptions | null>(null);
  const [adding, setAdding] = useState(false);

  const loadEmployees = useCallback(() => {
    api
      .listEmployees()
      .then(setEmployees)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load employees."));
  }, []);

  useEffect(loadEmployees, [loadEmployees]);

  // Pickers for the Add / Manage Access sheets — only fetched when the viewer can actually use them.
  useEffect(() => {
    if (!canCreate && !canEdit) return;
    Promise.all([api.listRoles(), api.listLocations()])
      .then(([roles, locations]) =>
        setAccessOptions({
          roles,
          locations,
          viewerIsSuperAdmin,
          // Same rule SERVER applies: a non-Super-Admin with a branch only manages that branch.
          branchScope: viewerIsSuperAdmin ? null : viewerBranchId,
        }),
      )
      .catch(() => {
        // The directory still works without these; the access buttons just stay hidden.
      });
  }, [canCreate, canEdit, viewerIsSuperAdmin, viewerBranchId]);

  /** Mirrors SERVER's loadManageableEmployee: needs employees.edit, a Super Admin is only
   * manageable by another Super Admin, and a branch-scoped viewer only manages their own branch. */
  function accessOptionsFor(employee: Employee): EmployeeAccessOptions | null {
    if (!canEdit || !accessOptions) return null;
    if (employee.isSuperAdmin && !viewerIsSuperAdmin) return null;
    if (accessOptions.branchScope && employee.branchId !== accessOptions.branchScope) return null;
    return accessOptions;
  }

  const branchOptions = useMemo(() => {
    if (!employees) return [];
    const names = new Set<string>();
    for (const e of employees) {
      if (e.branchName) names.add(e.branchName);
    }
    return [...names].sort();
  }, [employees]);

  const hasNoBranchEmployees = useMemo(() => employees?.some((e) => !e.branchName) ?? false, [employees]);

  const filteredEmployees = useMemo(() => {
    if (!employees) return null;
    if (branchFilter === ALL_FILTER) return employees;
    if (branchFilter === NO_BRANCH_FILTER) return employees.filter((e) => !e.branchName);
    return employees.filter((e) => e.branchName === branchFilter);
  }, [employees, branchFilter]);

  return (
    <div className="pb-10">
      {employees && employees.length > 0 && (
        <div className="sticky top-[60px] z-10 flex gap-1.5 overflow-x-auto border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip label="All" active={branchFilter === ALL_FILTER} onClick={() => setBranchFilter(ALL_FILTER)} />
          {branchOptions.map((name) => (
            <FilterChip key={name} label={name} active={branchFilter === name} onClick={() => setBranchFilter(name)} />
          ))}
          {hasNoBranchEmployees && (
            <FilterChip
              label="All Storefronts"
              active={branchFilter === NO_BRANCH_FILTER}
              onClick={() => setBranchFilter(NO_BRANCH_FILTER)}
            />
          )}
        </div>
      )}

      <div className="px-4 py-4">
        {canCreate && accessOptions && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            Add Employee
          </button>
        )}
        {error &&<div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!employees && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}

        {filteredEmployees && filteredEmployees.length > 0 && (
          <div className="relative">
            <div
              className="pointer-events-none absolute bottom-2 left-3 top-2 border-l-2 border-dashed border-navy/20"
              aria-hidden="true"
            />
            <div className="space-y-3 pl-7">
              {filteredEmployees.map((employee) => (
                <div key={employee.id} className="relative">
                  <span
                    className="pointer-events-none absolute -left-[19px] top-9 size-2 -translate-y-1/2 rounded-full border-2 border-navy/25 bg-cream-dark"
                    aria-hidden="true"
                  />
                  <EmployeeCard
                    employee={employee}
                    currency={currency}
                    isSelf={employee.id === currentEmployeeId}
                    accessOptions={accessOptionsFor(employee)}
                    onChanged={loadEmployees}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {adding && accessOptions && (
        <AddEmployeeModal
          options={accessOptions}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            loadEmployees();
          }}
        />
      )}
    </div>
  );
}
