"use client";

import { allowsDecimals, baseToAmount, unitChoices, unitFactor } from "@/lib/product-units";
import type { CheckoutCartLine } from "@/lib/types";
import { QuantityInput } from "./QuantityInput";
import { UnitSwitch } from "./UnitSwitch";

/**
 * A cart line's quantity, in the unit it's being sold in. line.quantity is always whole base units:
 * "1.5" with kg selected is 1500 of g. Switching unit keeps the same physical amount where it can
 * (1.5 kg -> 1500 g) and clears a typed price, which was per the old unit. A pack only sells whole,
 * so switching to it rounds to whole packs, never below one.
 */
export function CartLineQuantity({ line, onChange }: { line: CheckoutCartLine; onChange: (patch: Partial<CheckoutCartLine>) => void }) {
  const config = line.unitConfig ?? null;
  const code = line.unitCode ?? null;
  const factor = unitFactor(config, code);

  function setAmount(amount: number): void {
    const quantity = Math.round(amount * factor);
    if (quantity >= 1) onChange({ quantity });
  }

  function switchUnit(next: string | null): void {
    if (next === code) return;
    const nextFactor = unitFactor(config, next);
    const quantity = config?.kind === "pack" ? Math.max(1, Math.round(line.quantity / nextFactor)) * nextFactor : line.quantity;
    onChange({ unitCode: next, quantity, priceOverride: "" });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <QuantityInput value={baseToAmount(line.quantity, config, code)} onChange={setAmount} decimals={allowsDecimals(config, code)} />
      <UnitSwitch choices={unitChoices(line.unitOfMeasure ?? null, config)} value={code} onChange={switchUnit} />
    </div>
  );
}
