"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogOut, UserRound } from "lucide-react";
import { navGroups, type TabKey } from "./navigation";

const DRAWER_TRANSITION = { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const };

export function Sidebar({
  open,
  activeTab,
  employeeName,
  roleName,
  onSelect,
  onClose,
  onSignOut,
}: {
  open: boolean;
  activeTab: TabKey;
  employeeName: string;
  roleName: string;
  onSelect: (key: TabKey) => void;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-navy-deep/60"
            aria-hidden="true"
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={DRAWER_TRANSITION}
            className="fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-[300px] flex-col bg-navy py-5 shadow-[8px_0_32px_-12px_rgba(8,42,143,0.45)]"
          >
            <div className="flex items-center gap-2.5 border-b-2 border-white/15 px-4 pb-4">
              <img src="/BLUE_LEDGER.png" alt="" className="size-8 rounded-lg" />
              <div>
                <p className="text-xs font-extrabold tracking-wide text-white uppercase">Blue Ledger</p>
                <p className="text-[11px] font-semibold text-white/50">Owner App</p>
              </div>
            </div>

            <nav className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pl-4">
              {navGroups.map((group) => (
                <div key={group.title}>
                  <p className="px-2 text-[11px] font-extrabold tracking-wider text-white/50 uppercase">{group.title}</p>
                  <div className="relative mt-1.5">
                    <div
                      className="pointer-events-none absolute bottom-2 left-3 top-2 border-l-2 border-dashed border-white/15"
                      aria-hidden="true"
                    />
                    <div className="space-y-0.5 pl-6">
                      {group.items.map((item) => {
                        const active = item.key === activeTab;
                        return (
                          <div key={item.key} className="relative">
                            <span
                              className="pointer-events-none absolute -left-[15px] top-1/2 size-1.5 -translate-y-1/2 rounded-full border-2 border-white/25 bg-navy"
                              aria-hidden="true"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onSelect(item.key);
                                onClose();
                              }}
                              className={`relative flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-bold transition ${
                                active ? "text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {active && (
                                <motion.span
                                  layoutId="active-nav-pill"
                                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                                  className="absolute inset-0 rounded-lg bg-blue shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                                />
                              )}
                              <item.icon className="relative z-10 size-4 flex-none" aria-hidden="true" />
                              <span className="relative z-10">{item.label}</span>
                              {!item.ready && (
                                <span className="relative z-10 ml-auto text-[9px] font-bold tracking-wide text-white/40 uppercase">
                                  Soon
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </nav>

            <div className="mt-4 px-3">
              <div className="relative rounded-lg border border-white/10 bg-white/5 p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 flex-none place-items-center rounded-full border border-white/20">
                    <UserRound className="size-4 text-white/70" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-white">{employeeName}</p>
                    <p className="truncate text-[11px] font-semibold text-white/50">{roleName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onSignOut}
                    aria-label="Sign out"
                    className="grid size-7 flex-none place-items-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-red"
                  >
                    <LogOut className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
