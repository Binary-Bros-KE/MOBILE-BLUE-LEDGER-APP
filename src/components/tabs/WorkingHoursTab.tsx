"use client";

import { useEffect, useState } from "react";
import { Clock, Lock, Store } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { WorkingHoursListItem } from "@/lib/types";
import { WorkingHoursModal } from "../WorkingHoursModal";

/** Every storefront, Super-Admin-only (see navigation.ts's superAdminOnly flag) — tap one to
 * configure its hours/lock mode. Same list-tab conventions as ApprovalsTab, just a plain flat list
 * (no dashed timeline — these aren't time-ordered events, they're a fixed set of storefronts). */
export function WorkingHoursTab() {
  const [items, setItems] = useState<WorkingHoursListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WorkingHoursListItem | null>(null);

  function refresh(): void {
    setError(null);
    api
      .listWorkingHours()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load working hours."));
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur">
        <p className="text-xs font-bold text-navy/50">Working Hours</p>
      </div>

      <div className="px-4 py-4">
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!items && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {items && items.length === 0 && <p className="py-10 text-center text-sm text-navy/50">No storefronts to configure.</p>}

        {items && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => {
              const locked = item.config?.lockEnabled && item.config.lockMode === "manual" && item.config.manuallyLocked;
              return (
                <button
                  key={item.locationId}
                  type="button"
                  onClick={() => setSelected(item)}
                  className="flex w-full items-center gap-3 rounded-lg bg-white p-4 text-left shadow-sm"
                >
                  <div className="grid size-11 flex-none place-items-center rounded-full bg-navy text-white">
                    <Store className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-navy">{item.locationName}</p>
                    {item.config?.lockEnabled ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-navy/50">
                        <Clock className="size-3.5 flex-none" aria-hidden="true" />
                        {item.config.lockMode === "auto" ? "Locks outside working hours" : "Manual lock mode"}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs font-semibold text-navy/50">Always open</p>
                    )}
                  </div>
                  {locked && (
                    <span className="flex flex-none items-center gap-1 rounded-full border border-dashed border-red/30 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-red uppercase">
                      <Lock className="size-3" aria-hidden="true" />
                      Locked
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <WorkingHoursModal
          locationId={selected.locationId}
          locationName={selected.locationName}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
