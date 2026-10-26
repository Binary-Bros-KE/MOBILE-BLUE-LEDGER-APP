"use client";

import { CreditCard, LayoutDashboard, Menu, type LucideIcon } from "lucide-react";
import type { NavGroup, TabKey } from "./navigation";

/** The tabs a counter uses all day, most important first — the first four this employee can
 * actually open get a thumb-reach slot; everything else stays one tap away under "More" (the full
 * side menu). Labels/icons for Home and Sell are shortened from the menu's own. */
const PRIORITY: Array<{ key: TabKey; label?: string; icon?: LucideIcon }> = [
  { key: "dashboard", label: "Home", icon: LayoutDashboard },
  { key: "checkout", label: "Sell", icon: CreditCard },
  { key: "products" },
  { key: "sales" },
  { key: "cashUp" },
];

const SLOTS = 4;

/** Height of the bar (without the phone's home-indicator inset) — exported through the
 * --bottom-nav-h CSS variable AppShell sets, so anything else pinned to the bottom (Checkout's cart
 * bar) can sit right above it. */
export const BOTTOM_NAV_HEIGHT_PX = 60;

export function BottomNav({
  navGroups,
  activeTab,
  onSelect,
  onMore,
}: {
  /** Already permission-filtered (visibleNavGroups). */
  navGroups: NavGroup[];
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
  onMore: () => void;
}) {
  const visible = new Map(navGroups.flatMap((g) => g.items).map((item) => [item.key, item]));
  const slots = PRIORITY.filter((p) => visible.has(p.key))
    .slice(0, SLOTS)
    .map((p) => {
      const item = visible.get(p.key)!;
      return { key: p.key, label: p.label ?? item.label, icon: p.icon ?? item.icon };
    });
  const activeInSlots = slots.some((s) => s.key === activeTab);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(8,42,143,0.06)]"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg" style={{ height: BOTTOM_NAV_HEIGHT_PX }}>
        {slots.map(({ key, label, icon: Icon }) => {
          const active = key === activeTab;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${active ? "text-blue" : "text-navy/45"}`}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${activeInSlots ? "text-navy/45" : "text-blue"}`}
        >
          <Menu className="size-5" aria-hidden="true" />
          More
        </button>
      </div>
    </nav>
  );
}
