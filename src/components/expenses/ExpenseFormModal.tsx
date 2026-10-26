"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { centsToPriceText, priceTextToCents } from "@/lib/money";
import type { ExpenseListItem, MobileExpenseCategory, MobileLocation, PaymentMethodOption } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";

/** Today in the phone's own timezone as YYYY-MM-DD — toISOString() would roll over to tomorrow/
 * yesterday near midnight for anyone not on UTC. */
function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Record or edit an expense — the same fields DESKTOP's own Expense form has (minus the attachment):
 * date, amount, category (with quick-add), how it was paid, which storefront it came out of, who
 * paid, reference, description. A branch-scoped employee's storefront is fixed to their own, same as
 * SERVER enforces. `expense` null = create (id minted once, so a retry can't double-record).
 */
export function ExpenseFormModal({
  expense,
  storefronts,
  branchScope,
  canCreateCategory,
  onClose,
  onSaved,
}: {
  expense: ExpenseListItem | null;
  /** Storefront-type locations only — DESKTOP has no "General/Head Office" expense. */
  storefronts: MobileLocation[];
  branchScope: string | null;
  canCreateCategory: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categories, setCategories] = useState<MobileExpenseCategory[] | null>(null);
  const [methods, setMethods] = useState<PaymentMethodOption[] | null>(null);
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? localToday());
  const [amount, setAmount] = useState(expense ? centsToPriceText(expense.amountCents) : "");
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(expense?.paymentMethodId ?? "");
  const [storefrontId, setStorefrontId] = useState(branchScope ?? expense?.storefrontId ?? (storefronts.length === 1 ? storefronts[0]!.id : ""));
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? "");
  const [reference, setReference] = useState(expense?.reference ?? "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [newCategoryName, setNewCategoryName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expenseId = useRef(`expense_${crypto.randomUUID()}`);

  useEffect(() => {
    Promise.all([api.listExpenseCategories(), api.listPaymentMethods()])
      .then(([c, m]) => {
        setCategories(c);
        setMethods(m);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load categories and payment methods."));
  }, []);

  const method = methods?.find((m) => m.id === paymentMethodId) ?? null;

  async function handleCreateCategory(): Promise<void> {
    const name = newCategoryName?.trim();
    if (!name) return;
    try {
      const category = await api.createExpenseCategory(name);
      setCategories((prev) => [...(prev ?? []), category].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(category.id);
      setNewCategoryName(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create category.");
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const amountCents = priceTextToCents(amount);
    if (!amountCents) return setError("Enter the amount.");
    if (!categoryId) return setError("Choose a category.");
    if (!paymentMethodId) return setError("Choose how it was paid.");
    if (!storefrontId) return setError("Choose the storefront.");
    if (method?.requiresReference && !reference.trim()) return setError(`${method.name} needs a reference.`);

    const body = {
      expenseDate,
      categoryId,
      amountCents,
      paidBy: paidBy.trim() || null,
      paymentMethodId,
      storefrontId,
      reference: reference.trim() || null,
      description: description.trim() || null,
    };
    setSaving(true);
    setError(null);
    try {
      if (expense) await api.updateExpense(expense.id, body);
      else await api.createExpense({ ...body, id: expenseId.current });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title={expense ? "Edit Expense" : "Record Expense"} subtitle={expense?.expenseNumber} onClose={onClose}>
      {!categories || !methods ? (
        error ? <SheetError message={error} /> : <p className="py-10 text-center text-sm text-navy/50">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <SheetError message={error} />
          {expense?.sourceType && (
            <p className="rounded border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold-text">
              This expense was created automatically by a {expense.sourceType === "purchase" ? "purchase" : "sale"} — edit with care.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Amount">
              <input autoFocus={!expense} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required className={sheetInputClass} />
            </SheetField>
            <SheetField label="Date">
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required className={sheetInputClass} />
            </SheetField>
          </div>

          {newCategoryName === null ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SheetField label="Category">
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={sheetInputClass}>
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </SheetField>
              </div>
              {canCreateCategory && (
                <button
                  type="button"
                  onClick={() => setNewCategoryName("")}
                  aria-label="New category"
                  className="grid size-[38px] flex-none place-items-center rounded-lg border border-navy/15 text-navy/60 hover:bg-cream-dark"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SheetField label="New category name">
                  <input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className={sheetInputClass} />
                </SheetField>
              </div>
              <button type="button" onClick={() => void handleCreateCategory()} className="h-[38px] rounded-lg bg-navy px-3 text-xs font-bold text-white">
                Add
              </button>
              <button type="button" onClick={() => setNewCategoryName(null)} className="h-[38px] rounded-lg px-2 text-xs font-bold text-navy/50">
                Cancel
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Paid with">
              <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} className={sheetInputClass}>
                <option value="" disabled>
                  Choose
                </option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </SheetField>
            <SheetField label="Storefront">
              <select value={storefrontId} onChange={(e) => setStorefrontId(e.target.value)} disabled={branchScope !== null} className={sheetInputClass}>
                <option value="" disabled>
                  Choose
                </option>
                {storefronts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.locationName}
                  </option>
                ))}
              </select>
            </SheetField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label={method?.requiresReference ? "Reference" : "Reference (optional)"}>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. M-Pesa code" className={sheetInputClass} />
            </SheetField>
            <SheetField label="Paid by (optional)">
              <input value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={sheetInputClass} />
            </SheetField>
          </div>

          <SheetField label="Description (optional)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={sheetInputClass} />
          </SheetField>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : expense ? "Save Changes" : "Record Expense"}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
