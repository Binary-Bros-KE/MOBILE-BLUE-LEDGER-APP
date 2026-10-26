"use client";

import { sheetInputClass } from "../BottomSheet";

/** 6-digit numeric PIN input — `inputMode="numeric"` brings up the phone's number pad. */
export function PinInput({ value, onChange, autoFocus }: { value: string; onChange: (value: string) => void; autoFocus?: boolean }) {
  return (
    <input
      autoFocus={autoFocus}
      type="password"
      inputMode="numeric"
      autoComplete="new-password"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      placeholder="••••••"
      required
      className={`${sheetInputClass} tracking-[0.4em]`}
    />
  );
}
