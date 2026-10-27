"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReceiptText } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ExpenseListItem, MobileLocation } from "@/lib/types";
import { ExpenseCard } from "../ExpenseCard";
import { ExpenseDetailModal } from "../ExpenseDetailModal";
import { ExpenseFormModal } from "../expenses/ExpenseFormModal";
import { FilterChip } from "../FilterChip";

const ALL_FILTER = "__all__";

/** Same storefront-filter + dashed-timeline pattern as the other list tabs. "View more" opens
 * ExpenseDetailModal with the row ALREADY IN HAND — no second fetch, unlike every other detail
 * modal in this app (see mobile-expenses-service.ts's own note on why). Record / Edit / Archive
 * follow the viewer's expenses.create / edit / delete grants, same as DESKTOP. */
export function ExpensesTab({
  canCreate,
  canEdit,
  canArchive,
  canCreateCategory,
  viewerIsSuperAdmin,
  viewerBranchId,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canCreateCategory: boolean;
  viewerIsSuperAdmin: boolean;
  viewerBranchId: string | null;
}) {
  const [locations, setLocations] = useState<MobileLocation[] | null>(null);
  const [expenses, setExpenses] = useState<ExpenseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseListItem | null>(null);
  /** null = closed; { expense: null } = new expense; { expense } = editing that one. */
  const [form, setForm] = useState<{ expense: ExpenseListItem | null } | null>(null);

  const branchScope = viewerIsSuperAdmin ? null : viewerBranchId;
  // Storefront-type locations only — DESKTOP has no "General/Head Office" expense.
  const storefronts = useMemo(
    () => (locations ?? []).filter((l) => l.locationType !== "distribution_center" && l.locationType !== "warehouse"),
    [locations],
  );

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {
      // Filter chips just fall back to "All only" — not worth failing the whole tab over.
    });
  }, []);

  const loadExpenses = useCallback(() => {
    api
      .listExpenses(locationFilter === ALL_FILTER ? undefined : locationFilter)
      .then(setExpenses)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load expenses."));
  }, [locationFilter]);

  useEffect(loadExpenses, [loadExpenses]);

  /** Clears the list on a filter change so the old storefront's rows never flash under the new chip. */
  function selectFilter(locationId: string): void {
    setExpenses(null);
    setError(null);
    setLocationFilter(locationId);
  }

  // A branch-scoped employee can only edit/archive their own storefront's expenses (SERVER enforces).
  const canManage = (expense: ExpenseListItem) => !branchScope || expense.storefrontId === branchScope;

  return (
    <div className="pb-10">
      {locations && locations.length > 1 && (
        <div className="sticky top-[60px] z-10 flex gap-1.5 overflow-x-auto border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip label="All" active={locationFilter === ALL_FILTER} onClick={() => selectFilter(ALL_FILTER)} />
          {locations.map((location) => (
            <FilterChip
              key={location.id}
              label={location.locationName}
              active={locationFilter === location.id}
              onClick={() => selectFilter(location.id)}
            />
          ))}
        </div>
      )}

      <div className="px-4 py-4">
        {canCreate && locations && (
          <button
            type="button"
            onClick={() => setForm({ expense: null })}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white"
          >
            <ReceiptText className="size-4" aria-hidden="true" />
            Record Expense
          </button>
        )}
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!expenses && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {expenses && expenses.length === 0 && <p className="py-10 text-center text-sm text-navy/50">No expenses yet.</p>}

        {expenses && expenses.length > 0 && (
          <div className="relative">
            <div
              className="pointer-events-none absolute top-2 bottom-2 left-3 border-l-2 border-dashed border-navy/20"
              aria-hidden="true"
            />
            <div className="space-y-3 pl-7">
              {expenses.map((expense) => (
                <div key={expense.id} className="relative">
                  <span
                    className="pointer-events-none absolute top-9 -left-[19px] size-2 -translate-y-1/2 rounded-full border-2 border-navy/25 bg-cream-dark"
                    aria-hidden="true"
                  />
                  <ExpenseCard expense={expense} onSelect={() => setSelectedExpense(expense)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedExpense && (
        <ExpenseDetailModal
          expense={selectedExpense}
          onClose={() => setSelectedExpense(null)}
          onEdit={
            canEdit && canManage(selectedExpense) && locations
              ? () => {
                  setForm({ expense: selectedExpense });
                  setSelectedExpense(null);
                }
              : undefined
          }
          canArchive={canArchive && canManage(selectedExpense)}
          onArchived={() => {
            setSelectedExpense(null);
            loadExpenses();
          }}
        />
      )}
      {form && (
        <ExpenseFormModal
          expense={form.expense}
          storefronts={storefronts}
          branchScope={branchScope}
          workingStorefrontId={storefronts.some((l) => l.id === viewerBranchId) ? viewerBranchId : null}
          canCreateCategory={canCreateCategory}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            loadExpenses();
          }}
        />
      )}
    </div>
  );
}
