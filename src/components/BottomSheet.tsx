"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";

/** The bottom-sheet frame shared by the Employees and Products management forms — same look as
 * QuickCreateCustomerModal, factored out because every one of those sibling forms would otherwise
 * repeat it verbatim. */
export function BottomSheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-display text-lg text-navy">{title}</p>
            {subtitle && <p className="text-xs text-navy/50">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export const sheetInputClass =
  "mt-1 w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none disabled:bg-cream-dark disabled:text-navy/50";

export function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="text-[11px] font-semibold text-navy/50">{label}</span>
      {children}
    </label>
  );
}

export function SheetError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{message}</p>;
}
