"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { Salary } from "@/lib/types";

const STATUS_TONE: Record<string, string> = {
  active: "border-green text-green",
  draft: "border-gold text-gold-text",
  voided: "border-red text-red",
};

export function PayslipModal({ salary, currency, onClose }: { salary: Salary; currency: string; onClose: () => void }) {
  const statusTone = STATUS_TONE[salary.status] ?? "border-navy/30 text-navy/60";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-display text-lg text-navy">{salary.payslipNumber}</p>
            <p className="text-xs text-navy/50">{salary.payPeriod}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <span
          className={`inline-flex items-center rounded-full border border-dashed bg-white px-2.5 py-1 text-[11px] font-extrabold tracking-wide uppercase ${statusTone}`}
        >
          {salary.status}
        </span>

        <div className="mt-4 space-y-1.5 border-t border-dashed border-navy/15 pt-4 text-sm">
          <Row label="Basic salary" value={formatCents(salary.basicSalaryCents, currency)} />
        </div>

        {salary.allowances.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-dashed border-navy/15 pt-4">
            <p className="text-[11px] font-bold tracking-wide text-navy/40 uppercase">Allowances</p>
            {salary.allowances.map((a, i) => (
              <Row key={i} label={a.name} value={formatCents(a.amountCents, currency)} />
            ))}
            <Row label="Total allowances" value={formatCents(salary.allowancesCents, currency)} strong />
          </div>
        )}

        {salary.deductions.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-dashed border-navy/15 pt-4">
            <p className="text-[11px] font-bold tracking-wide text-navy/40 uppercase">Deductions</p>
            {salary.deductions.map((d, i) => (
              <Row key={i} label={d.name} value={`- ${formatCents(d.amountCents, currency)}`} />
            ))}
            <Row label="Total deductions" value={`- ${formatCents(salary.deductionsCents, currency)}`} strong />
          </div>
        )}

        <div className="mt-4 border-t-2 border-navy/15 pt-4">
          <Row label="Net pay" value={formatCents(salary.netPayCents, currency)} strong big />
        </div>

        <div className="mt-4 space-y-1.5 border-t border-dashed border-navy/15 pt-4 text-xs text-navy/60">
          {salary.paymentMethodName && <Row label="Payment method" value={salary.paymentMethodName} />}
          {salary.paymentReference && <Row label="Reference" value={salary.paymentReference} />}
          {salary.notes && <p className="pt-1 italic text-navy/50">{salary.notes}</p>}
        </div>
      </motion.div>
    </div>
  );
}

function Row({ label, value, strong, big }: { label: string; value: string; strong?: boolean; big?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "font-bold text-navy" : "text-navy/60"}>{label}</span>
      <span className={big ? "font-display text-xl text-navy" : strong ? "font-bold text-navy" : "font-semibold text-navy"}>
        {value}
      </span>
    </div>
  );
}
