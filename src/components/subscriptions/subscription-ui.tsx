"use client";

import { Check } from "lucide-react";
import { SUBSCRIPTION_NOTICE_STAGES, type SubscriptionStage } from "@/lib/subscription-schedule";
import type { MobileSubscription } from "@/lib/types";

/** Same colour per stage as DESKTOP: green, yellow, orange, red, then dark red once expired. */
export const STAGE_TONE: Record<SubscriptionStage, { pill: string; edge: string; dot: string }> = {
  active: { pill: "border-green text-green", edge: "border-l-green", dot: "bg-green" },
  week: { pill: "border-gold text-gold-text", edge: "border-l-gold", dot: "bg-gold" },
  three_days: { pill: "border-orange-500 text-orange-600", edge: "border-l-orange-500", dot: "bg-orange-500" },
  due: { pill: "border-red text-red", edge: "border-l-red", dot: "bg-red" },
  expired: { pill: "border-red-900 bg-red-900 text-white", edge: "border-l-red-900", dot: "bg-red-900" },
};

export const STAGE_URGENCY: Record<SubscriptionStage, number> = { expired: 0, due: 1, three_days: 2, week: 3, active: 4 };

export function formatSubscriptionDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft === 0) return "Expires today";
  if (daysLeft === 1) return "1 day left";
  if (daysLeft > 0) return `${daysLeft} days left`;
  return daysLeft === -1 ? "Expired yesterday" : `Expired ${-daysLeft} days ago`;
}

export function StagePill({ subscription }: { subscription: Pick<MobileSubscription, "stage" | "daysLeft" | "status"> }) {
  if (subscription.status !== "active") {
    return (
      <span className="rounded-full border border-dashed border-navy/20 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-navy/50 uppercase">
        {subscription.status === "cancelled" ? "Cancelled" : "Renewed"}
      </span>
    );
  }
  return (
    <span className={`whitespace-nowrap rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${STAGE_TONE[subscription.stage].pill}`}>
      {daysLeftLabel(subscription.daysLeft)}
    </span>
  );
}

/** The four reminders as dots: filled once sent, ringed when due now. */
export function NoticeDots({ subscription }: { subscription: MobileSubscription }) {
  return (
    <div className="flex items-center gap-1">
      {SUBSCRIPTION_NOTICE_STAGES.map((stage) => {
        const sent = subscription.notices.some((notice) => notice.stage === stage);
        const due = subscription.pendingNotice === stage;
        return (
          <span
            key={stage}
            className={`grid size-4 place-items-center rounded-full border text-white ${
              sent ? `border-transparent ${STAGE_TONE[stage].dot}` : due ? "animate-pulse border-2 border-red bg-white" : "border-navy/15 bg-cream-dark"
            }`}
          >
            {sent && <Check className="size-2.5" aria-hidden="true" />}
          </span>
        );
      })}
    </div>
  );
}
