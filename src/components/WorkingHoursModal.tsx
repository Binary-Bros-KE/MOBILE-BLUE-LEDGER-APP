"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Loader2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { WorkingHoursLockMode, WorkingHoursSchedule, WorkingHoursUpsertInput } from "@/lib/types";

// Displayed Monday-first even though the underlying keys are "0".."6" = Sunday..Saturday, matching
// JS Date.getDay() — the same convention computeWorkingHoursLockStatus reads server-side.
const DAYS: Array<{ key: string; label: string }> = [
  { key: "1", label: "Monday" },
  { key: "2", label: "Tuesday" },
  { key: "3", label: "Wednesday" },
  { key: "4", label: "Thursday" },
  { key: "5", label: "Friday" },
  { key: "6", label: "Saturday" },
  { key: "0", label: "Sunday" },
];

const LOCK_MODE_OPTIONS: Array<{ value: WorkingHoursLockMode; label: string }> = [
  { value: "auto", label: "Automatic — lock outside the hours below" },
  { value: "manual", label: "Manual — I'll lock/unlock it myself" },
];

function emptySchedule(): WorkingHoursSchedule {
  const schedule: WorkingHoursSchedule = {};
  for (const day of DAYS) schedule[day.key] = { isOpen: true, openTime: "08:00", closeTime: "18:00" };
  return schedule;
}

function emptyForm(): WorkingHoursUpsertInput {
  return {
    lockEnabled: false,
    lockMode: "auto",
    manuallyLocked: false,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    schedule: emptySchedule(),
  };
}

/** Same fields as DESKTOP's own Working Hours editor — per-day schedule, lock-enabled toggle,
 * auto/manual mode, and (in manual mode) the manual lock switch itself. Built as this app's own
 * bottom-sheet modal, matching ServiceChargesModal/CheckoutDeliveryModal conventions. */
export function WorkingHoursModal({
  locationId,
  locationName,
  onClose,
  onSaved,
}: {
  locationId: string;
  locationName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<WorkingHoursUpsertInput>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getWorkingHours(locationId)
      .then((existing) => {
        if (cancelled) return;
        if (!existing) {
          setForm(emptyForm());
          return;
        }
        setForm({
          lockEnabled: existing.lockEnabled,
          lockMode: existing.lockMode,
          manuallyLocked: existing.manuallyLocked,
          timezoneOffsetMinutes: existing.timezoneOffsetMinutes,
          schedule: existing.schedule,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load working hours.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  function updateDay(dayKey: string, patch: Partial<WorkingHoursSchedule[string]>): void {
    setForm((prev) => ({
      ...prev,
      schedule: { ...prev.schedule, [dayKey]: { ...prev.schedule[dayKey], ...patch } as WorkingHoursSchedule[string] },
    }));
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await api.saveWorkingHours(locationId, form);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save working hours.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <p className="flex items-center gap-1.5 font-display text-lg text-navy">
              <Clock className="size-4 text-blue" aria-hidden="true" />
              Working Hours
            </p>
            <p className="text-xs text-navy/50">{locationName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-navy/50">Loading…</p>
          ) : (
            <>
              {error && <p className="mb-3 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{error}</p>}

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-navy/15 bg-cream-dark/60 p-3">
                <input
                  type="checkbox"
                  checked={form.lockEnabled}
                  onChange={(e) => setForm((prev) => ({ ...prev, lockEnabled: e.target.checked }))}
                  className="mt-0.5 size-4 flex-none accent-blue"
                />
                <span>
                  <span className="block text-sm font-bold text-navy">Lock outside working hours</span>
                  <span className="block text-xs text-navy/50">Everyone except your Super Admin loses access while this storefront is locked.</span>
                </span>
              </label>

              {form.lockEnabled && (
                <>
                  <label className="mt-3 block">
                    <span className="text-[11px] font-semibold text-navy/50">Lock mode</span>
                    <select
                      value={form.lockMode}
                      onChange={(e) => setForm((prev) => ({ ...prev, lockMode: e.target.value as WorkingHoursLockMode }))}
                      className="mt-1 h-10 w-full rounded-lg border border-navy/15 bg-white px-2.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
                    >
                      {LOCK_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {form.lockMode === "manual" ? (
                    <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-navy/15 bg-cream-dark/60 p-3">
                      <input
                        type="checkbox"
                        checked={form.manuallyLocked}
                        onChange={(e) => setForm((prev) => ({ ...prev, manuallyLocked: e.target.checked }))}
                        className="mt-0.5 size-4 flex-none accent-blue"
                      />
                      <span>
                        <span className="block text-sm font-bold text-navy">Currently locked</span>
                        <span className="block text-xs text-navy/50">
                          Flip this off to unlock right now — the schedule below is ignored entirely in manual mode.
                        </span>
                      </span>
                    </label>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {DAYS.map((day) => {
                        const value = form.schedule[day.key] ?? { isOpen: true, openTime: "08:00", closeTime: "18:00" };
                        return (
                          <div key={day.key} className="flex items-center gap-2 rounded-lg border border-navy/15 bg-cream-dark/40 px-2.5 py-2">
                            <label className="flex w-24 flex-none cursor-pointer items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={value.isOpen}
                                onChange={(e) => updateDay(day.key, { isOpen: e.target.checked })}
                                className="size-3.5 flex-none accent-blue"
                              />
                              <span className="text-[11px] font-bold text-navy">{day.label}</span>
                            </label>
                            {value.isOpen ? (
                              <div className="flex flex-1 items-center gap-1.5">
                                <input
                                  type="time"
                                  value={value.openTime ?? "08:00"}
                                  onChange={(e) => updateDay(day.key, { openTime: e.target.value })}
                                  className="h-8 w-full rounded-md border border-navy/15 bg-white px-1.5 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
                                />
                                <span className="text-[10px] font-bold text-navy/40">to</span>
                                <input
                                  type="time"
                                  value={value.closeTime ?? "18:00"}
                                  onChange={(e) => updateDay(day.key, { closeTime: e.target.value })}
                                  className="h-8 w-full rounded-md border border-navy/15 bg-white px-1.5 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
                                />
                              </div>
                            ) : (
                              <span className="flex-1 text-xs font-semibold text-navy/40">Closed</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="mt-3 text-[10px] font-semibold text-navy/40">
                    Hours are based on this phone&apos;s own timezone. DESKTOP can also configure this storefront&apos;s working hours.
                  </p>
                </>
              )}

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {saving ? "Saving…" : "Save working hours"}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
