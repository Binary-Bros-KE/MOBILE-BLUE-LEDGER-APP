"use client";

import type { RequisitionStatus } from "@/lib/types";

const STATUS_TONE: Record<RequisitionStatus, string> = {
  pending: "border-gold text-gold-text",
  approved: "border-green text-green",
  rejected: "border-red text-red",
  cancelled: "border-navy/30 text-navy/50",
};

export function RequisitionStatusPill({ status }: { status: RequisitionStatus }) {
  return (
    <span className={`flex-none rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${STATUS_TONE[status]}`}>
      {status}
    </span>
  );
}

export function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}
