"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

/** A cart line's quantity: type any whole number (250 for a quarter kilo of rice), or nudge it with
 * the buttons. `draft` only exists while typing, so the field can be emptied on the way to a new number
 * without the line ever holding 0; anything that isn't a valid quantity goes back to the last one on
 * blur. Whole numbers only, same as SERVER's checkout schema. */
export function QuantityInput({ value, onChange }: { value: number; onChange: (quantity: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  function handleType(text: string): void {
    const digits = text.replace(/\D/g, "");
    setDraft(digits);
    const quantity = Number(digits);
    if (quantity >= 1) onChange(quantity);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Reduce quantity"
        className="grid size-7 flex-none place-items-center rounded-md border border-navy/15 text-navy/60 disabled:opacity-30"
      >
        <Minus className="size-3" aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        maxLength={7}
        value={draft ?? String(value)}
        onChange={(e) => handleType(e.target.value)}
        // Selected on tap, so typing 250 replaces the 1 rather than making it 1250.
        onFocus={(e) => e.target.select()}
        onBlur={() => setDraft(null)}
        aria-label="Quantity"
        className="h-7 w-14 rounded-md border border-navy/15 px-1 text-center text-sm font-bold text-navy focus:border-blue focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
        className="grid size-7 flex-none place-items-center rounded-md border border-navy/15 text-navy/60"
      >
        <Plus className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}
