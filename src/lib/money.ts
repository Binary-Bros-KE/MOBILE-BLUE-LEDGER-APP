/** The "Sourced from another shop" cost field is typed as a per-unit price (matching the "Price"
 * override field right next to it) but stored/reported as the line's TOTAL cost (localCostCents —
 * mirrors DESKTOP's own money.ts pair exactly, same fix, same reasoning: the client reported a
 * cashier could silently understate a multi-unit line's true cost by typing per-unit while the
 * system treated it as the whole line's total). Keeps that split at the UI edges only — multiply
 * right before it leaves the form, divide right when an existing total is loaded back in. */
export function unitCostToTotalCents(unitCostText: string, quantity: number): number {
  const parsed = Number.parseFloat(unitCostText);
  const unitCents = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
  return Math.round(unitCents * quantity);
}

/** Inverse of unitCostToTotalCents — turns a stored TOTAL localCostCents back into the per-unit text
 * this field now expects, e.g. when opening an existing invoice/quotation for edit. Null/non-positive
 * quantity (shouldn't happen — every line always has at least 1) falls back to "". */
export function totalCentsToUnitCostText(totalCents: number | null, quantity: number): string {
  if (totalCents === null || !Number.isFinite(totalCents) || quantity <= 0) return "";
  return (Math.round(totalCents / quantity) / 100).toFixed(2);
}

export function formatCents(cents: number, currency: string): string {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    // Intl throws on an unrecognized currency code — fall back to a plain prefix rather than crash.
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
}
