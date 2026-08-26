"use client";

/** Small reusable checkbox + label(+description) — mirrors DESKTOP's own shared/components/
 * form-fields.tsx CheckboxField, styled to APP's existing inline checkbox convention (the same
 * markup InvoiceFormModal.tsx/CheckoutTab.tsx/CartItemsEditor.tsx/WorkingHoursModal.tsx each already
 * repeat inline). Extracted here since this plan adds several more checkbox instances at once. */
export function CheckboxField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-navy/10 bg-cream-dark/40 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-3.5 flex-none accent-blue"
      />
      <span>
        <span className="block text-xs font-bold text-navy/70">{label}</span>
        {description && <span className="block text-[11px] font-semibold text-navy/45">{description}</span>}
      </span>
    </label>
  );
}
