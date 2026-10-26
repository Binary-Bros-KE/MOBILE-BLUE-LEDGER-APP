"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Employee } from "@/lib/types";
import { BottomSheet, SheetError, SheetField } from "../BottomSheet";
import { PinInput } from "./PinInput";

/** Sets a new 6-digit PIN — for the employee's own account, or (with employees.edit) someone else's.
 * SERVER also clears their Owner App login lockout, so a staff member who locked themselves out by
 * guessing can log straight back in with the new PIN. Reaches every DESKTOP at its next sync. */
export function ChangePinModal({
  employee,
  isSelf,
  onClose,
  onSaved,
}: {
  employee: Employee;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (pin.length !== 6) return setError("PIN must be exactly 6 digits.");
    if (pin !== confirmPin) return setError("PIN and confirmation do not match.");
    setSaving(true);
    setError(null);
    try {
      await api.resetEmployeePin(employee.id, pin);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change PIN.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      title={isSelf ? "Change My PIN" : "Reset PIN"}
      subtitle={isSelf ? "Use it next time you log in, here and on the POS." : `New login PIN for ${employee.firstName} ${employee.lastName}.`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <SheetError message={error} />
        <SheetField label="New PIN (6 digits)">
          <PinInput autoFocus value={pin} onChange={setPin} />
        </SheetField>
        <SheetField label="Confirm new PIN">
          <PinInput value={confirmPin} onChange={setConfirmPin} />
        </SheetField>
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Save PIN"}
        </button>
      </form>
    </BottomSheet>
  );
}
