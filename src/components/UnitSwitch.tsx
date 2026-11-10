"use client";

import type { UnitChoice } from "@/lib/product-units";

/** The kg | g switch next to a quantity. Renders nothing for a product with one unit. */
export function UnitSwitch({ choices, value, onChange }: { choices: UnitChoice[]; value: string | null; onChange: (code: string | null) => void }) {
  if (choices.length < 2) return null;
  return (
    <div className="flex flex-none rounded-md bg-cream-dark p-0.5">
      {choices.map((choice) => (
        <button
          key={choice.code ?? "__base__"}
          type="button"
          onClick={() => onChange(choice.code)}
          aria-pressed={value === choice.code}
          className={`min-w-7 rounded px-1.5 py-1 text-[11px] font-bold ${value === choice.code ? "bg-white text-navy shadow-sm" : "text-navy/50"}`}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
