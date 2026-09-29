"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { ProductListItem } from "@/lib/types";
import { separateGroupMembers, type VariantPick } from "@/lib/variants";

/**
 * "Which one?" sheet when a product with variants is added (Checkout, Invoice/Quotation items) —
 * the Owner App twin of DESKTOP's VariantPickerModal. Shared stock: pick a value per option
 * (impossible combinations greyed out; one tap when there's a single option). Separate stock: pick
 * one of the group's products, each with its own price and stock.
 */
export function VariantPickerSheet({
  product,
  products,
  currency,
  stockOf,
  onPick,
  onClose,
}: {
  product: ProductListItem;
  products: ProductListItem[];
  currency: string;
  stockOf: (product: ProductListItem) => number;
  onPick: (pick: VariantPick) => void;
  onClose: () => void;
}) {
  const info = product.variants ?? null;
  const shared = info?.mode === "shared" ? info : null;
  const members = useMemo(() => (shared ? [] : separateGroupMembers(product, products)), [shared, product, products]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const variants = shared?.shared ?? [];
  const options = shared?.options.filter((o) => o.values.some((v) => variants.some((x) => x.values[o.name] === v))) ?? [];

  function available(optionName: string, value: string): boolean {
    return variants.some(
      (v) => v.values[optionName] === value && Object.entries(selected).every(([n, picked]) => n === optionName || v.values[n] === picked),
    );
  }
  const resolved = options.every((o) => selected[o.name])
    ? (variants.find((v) => options.every((o) => v.values[o.name] === selected[o.name])) ?? null)
    : null;

  function pickShared(values: Record<string, string>): void {
    const v = variants.find((x) => options.every((o) => x.values[o.name] === values[o.name]));
    if (v) onPick({ product, variantKey: v.key, label: v.label, priceCents: v.priceCents ?? product.sellingPriceCents });
  }

  function choose(optionName: string, value: string): void {
    const next = { ...selected, [optionName]: value };
    for (const [n, picked] of Object.entries(next)) {
      if (n !== optionName && !variants.some((v) => v.values[optionName] === value && v.values[n] === picked)) delete next[n];
    }
    if (options.length === 1) {
      pickShared(next);
      return;
    }
    setSelected(next);
  }

  const title = info?.title ?? product.name;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="min-w-0">
            <p className="font-display text-lg text-navy">{title}</p>
            <p className="text-xs text-navy/50">Choose the variant</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5">
          {shared ? (
            <div className="space-y-4">
              {options.map((option) => (
                <div key={option.name}>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-navy/50">
                    {option.name}
                    {selected[option.name] ? <span className="text-navy"> · {selected[option.name]}</span> : null}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const on = selected[option.name] === value;
                      const ok = available(option.name, value);
                      const single = options.length === 1 ? variants.find((v) => v.values[option.name] === value) : null;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={!ok && !on}
                          onClick={() => choose(option.name, value)}
                          className={`min-w-14 rounded-lg border-2 px-3 py-2 text-left text-sm font-bold transition ${
                            on
                              ? "border-navy bg-navy text-white"
                              : ok
                                ? "border-navy/15 bg-white text-navy active:bg-cream"
                                : "border-navy/10 bg-cream text-navy/30 line-through"
                          }`}
                        >
                          {value}
                          {single ? (
                            <span className={`block text-[11px] font-semibold ${on ? "text-white/80" : "text-navy/50"}`}>
                              {formatCents(single.priceCents ?? product.sellingPriceCents, currency)}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {options.length > 1 ? (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-cream px-3 py-2.5">
                  <div className="min-w-0 text-sm">
                    {resolved ? (
                      <>
                        <p className="font-bold text-navy">{resolved.label}</p>
                        <p className="text-xs text-navy/60">
                          {formatCents(resolved.priceCents ?? product.sellingPriceCents, currency)} · {stockOf(product)} in stock (shared)
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-navy/60">Pick {options.map((o) => o.name).join(" and ")}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!resolved}
                    onClick={() => resolved && pickShared(resolved.values)}
                    className="flex flex-none items-center gap-1 rounded-lg bg-navy px-4 py-2 text-xs font-extrabold uppercase text-white disabled:opacity-40"
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                    Add
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-navy/50">{stockOf(product)} in stock, shared by all variants</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {members.map((member) => {
                const qty = stockOf(member);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => onPick({ product: member, variantKey: null, label: null, priceCents: member.sellingPriceCents })}
                    className={`rounded-lg border-2 px-3 py-2.5 text-left transition active:bg-cream ${
                      member.id === product.id ? "border-blue/40 bg-blue/5" : "border-navy/10 bg-white"
                    }`}
                  >
                    <span className="block text-sm font-bold text-navy">{member.variants?.label ?? member.name}</span>
                    <span className="block text-xs text-navy/60">{formatCents(member.sellingPriceCents, currency)}</span>
                    <span className={`block text-[11px] font-bold ${qty > 0 ? "text-green" : "text-red"}`}>
                      {qty > 0 ? `${qty} in stock` : "Out of stock"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
