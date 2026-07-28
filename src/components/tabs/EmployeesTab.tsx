"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Employee } from "@/lib/types";
import { EmployeeCard } from "../EmployeeCard";
import { FilterChip } from "../FilterChip";

const ALL_FILTER = "__all__";
// A distinct bucket from ALL_FILTER — this one narrows down to employees with no single assigned
// storefront (branchName null), not "don't filter at all".
const NO_BRANCH_FILTER = "__no_branch__";

export function EmployeesTab({ currency }: { currency: string }) {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState(ALL_FILTER);

  useEffect(() => {
    api
      .listEmployees()
      .then(setEmployees)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load employees."));
  }, []);

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
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
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
                  <EmployeeCard employee={employee} currency={currency} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
