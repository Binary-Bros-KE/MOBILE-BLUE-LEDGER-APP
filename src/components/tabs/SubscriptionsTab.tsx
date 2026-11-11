"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Plus, Search, Send, Tv } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { SUBSCRIPTION_NOTICE_LABELS, type SubscriptionNoticeStage, type SubscriptionStage } from "@/lib/subscription-schedule";
import type { MobileSubscription, MobileSubscriptionServiceSuggestion } from "@/lib/types";
import { FilterChip } from "../FilterChip";
import { SubscriptionDetailSheet } from "../subscriptions/SubscriptionDetailSheet";
import { SubscriptionFormSheet } from "../subscriptions/SubscriptionFormSheet";
import { NoticeDots, STAGE_TONE, STAGE_URGENCY, StagePill, daysLeftLabel } from "../subscriptions/subscription-ui";

type Filter = "all" | "reminders" | SubscriptionStage | "cancelled";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "reminders", label: "Reminders" },
  { value: "week", label: "This week" },
  { value: "three_days", label: "3 days" },
  { value: "due", label: "Today" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

/** DStv, GOtv and other subscriptions the shop renews for its customers — same rows as DESKTOP's
 * Subscriptions tab. The reminder queue sits on top: send through WhatsApp from this phone, then mark
 * it sent so nobody (on a till either) sends it twice. */
export function SubscriptionsTab({
  currency,
  businessName,
  canCreate,
  canEdit,
}: {
  currency: string;
  businessName: string;
  canCreate: boolean;
  canEdit: boolean;
}) {
  const [subscriptions, setSubscriptions] = useState<MobileSubscription[] | null>(null);
  const [suggestions, setSuggestions] = useState<MobileSubscriptionServiceSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<{ subscription: MobileSubscription; sendStage: SubscriptionNoticeStage | null } | null>(null);

  const load = useCallback(() => {
    Promise.all([api.listSubscriptions(), api.listSubscriptionSuggestions()])
      .then(([list, services]) => {
        setSubscriptions(list);
        setSuggestions(services);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load subscriptions."));
  }, []);

  useEffect(load, [load]);

  const active = useMemo(() => (subscriptions ?? []).filter((s) => s.status === "active"), [subscriptions]);
  const queue = useMemo(
    () => active.filter((s) => s.pendingNotice !== null).sort((a, b) => STAGE_URGENCY[a.stage] - STAGE_URGENCY[b.stage] || a.daysLeft - b.daysLeft),
    [active],
  );

  const filtered = useMemo(() => {
    if (!subscriptions) return null;
    const term = search.trim().toLowerCase();
    return subscriptions
      .filter((s) => {
        if (filter === "cancelled") return s.status === "cancelled";
        if (s.status !== "active") return false;
        if (filter === "reminders") return s.pendingNotice !== null;
        return filter === "all" || s.stage === filter;
      })
      .filter((s) => !term || `${s.customerName} ${s.customerPhone ?? ""} ${s.serviceName} ${s.accountNumber ?? ""}`.toLowerCase().includes(term))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [subscriptions, search, filter]);

  function replace(updated: MobileSubscription): void {
    // A renewal comes back as the NEW period: drop the old one, which is now history.
    setSubscriptions((prev) => [updated, ...(prev ?? []).filter((s) => s.id !== updated.id && s.id !== updated.renewedFromId)]);
  }

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 border-b border-navy/10 bg-cream-dark/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, service, smartcard…"
              className="w-full rounded-lg border border-navy/15 bg-white py-2 pr-3 pl-9 text-sm text-navy placeholder:text-navy/30 focus:border-blue focus:outline-none"
            />
          </div>
          {canCreate && (
            <button type="button" onClick={() => setCreating(true)} className="flex flex-none items-center gap-1 rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white">
              <Plus className="size-3.5" aria-hidden="true" />
              New
            </button>
          )}
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((option) => (
            <FilterChip
              key={option.value}
              label={option.value === "reminders" && queue.length > 0 ? `${option.label} (${queue.length})` : option.label}
              active={filter === option.value}
              onClick={() => setFilter(option.value)}
            />
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!subscriptions && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}

        {filter === "all" && queue.length > 0 && (
          <div className="mb-4 rounded-lg border-2 border-red/30 bg-white p-3 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy">
              <BellRing className="size-4 text-red" aria-hidden="true" />
              Needs a reminder ({queue.length})
            </p>
            <div className="space-y-1.5">
              {queue.slice(0, 5).map((s) => (
                <div key={s.id} className={`flex items-center justify-between gap-2 rounded-lg border border-navy/10 border-l-4 px-2.5 py-2 ${STAGE_TONE[s.stage].edge}`}>
                  <button type="button" onClick={() => setOpen({ subscription: s, sendStage: null })} className="min-w-0 text-left">
                    <p className="truncate text-sm font-bold text-navy">{s.customerName}</p>
                    <p className="truncate text-[11px] text-navy/50">
                      {s.serviceName} · {daysLeftLabel(s.daysLeft)} · {SUBSCRIPTION_NOTICE_LABELS[s.pendingNotice!]}
                    </p>
                  </button>
                  {canEdit && (
                    <button type="button" onClick={() => setOpen({ subscription: s, sendStage: s.pendingNotice })} className="flex flex-none items-center gap-1 rounded-lg bg-red px-2.5 py-1.5 text-[11px] font-bold text-white">
                      <Send className="size-3.5" aria-hidden="true" />
                      Send
                    </button>
                  )}
                </div>
              ))}
            </div>
            {queue.length > 5 && (
              <button type="button" onClick={() => setFilter("reminders")} className="mt-2 text-xs font-bold text-blue">
                Show all {queue.length}
              </button>
            )}
          </div>
        )}

        {filtered && filtered.length === 0 && (
          <div className="py-10 text-center">
            <Tv className="mx-auto size-8 text-navy/20" aria-hidden="true" />
            <p className="mt-2 text-sm text-navy/50">{subscriptions?.length ? "Nothing matches." : "No subscriptions yet."}</p>
          </div>
        )}

        {filtered && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setOpen({ subscription: s, sendStage: null })}
                className={`flex w-full flex-col gap-2 rounded-lg border-l-4 bg-white p-3 text-left shadow-sm ${s.status === "active" ? STAGE_TONE[s.stage].edge : "border-l-navy/15"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-navy">{s.customerName}</p>
                    <p className="truncate text-xs text-navy/50">
                      {s.serviceName}
                      {s.accountNumber ? ` · ${s.accountNumber}` : ""}
                    </p>
                  </div>
                  <StagePill subscription={s} />
                </div>
                <div className="flex items-center justify-between">
                  <NoticeDots subscription={s} />
                  {s.pendingNotice && <span className="text-[10px] font-extrabold tracking-wide text-red uppercase">Reminder due</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <SubscriptionFormSheet
          suggestions={suggestions}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            replace(saved);
            load();
          }}
        />
      )}
      {open && (
        <SubscriptionDetailSheet
          key={open.subscription.id}
          subscription={open.subscription}
          businessName={businessName}
          currency={currency}
          canEdit={canEdit}
          canRenew={canCreate}
          initialSendStage={open.sendStage}
          onClose={() => setOpen(null)}
          onChanged={replace}
        />
      )}
    </div>
  );
}
