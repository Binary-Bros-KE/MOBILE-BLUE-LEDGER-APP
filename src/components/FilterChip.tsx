"use client";

export function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-none whitespace-nowrap rounded px-3.5 py-2 text-xs font-bold tracking-wide transition ${
        active ? "bg-navy text-white" : "bg-white text-navy/60"
      }`}
    >
      {label.toUpperCase()}
    </button>
  );
}
