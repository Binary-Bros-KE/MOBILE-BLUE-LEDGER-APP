"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { MobileSessionInfo } from "@/lib/types";
import { DashboardTab } from "../tabs/DashboardTab";
import { EmployeesTab } from "../tabs/EmployeesTab";
import { ExpensesTab } from "../tabs/ExpensesTab";
import { InvoicesTab } from "../tabs/InvoicesTab";
import { ProductsTab } from "../tabs/ProductsTab";
import { PurchasesTab } from "../tabs/PurchasesTab";
import { QuotationsTab } from "../tabs/QuotationsTab";
import { SalesTab } from "../tabs/SalesTab";
import { StockLedgerTab } from "../tabs/StockLedgerTab";
import { TransactionsTab } from "../tabs/TransactionsTab";
import { navGroups, type TabKey } from "./navigation";
import { Sidebar } from "./Sidebar";

const TAB_LABELS: Record<TabKey, string> = Object.fromEntries(
  navGroups.flatMap((group) => group.items.map((item) => [item.key, item.label])),
) as Record<TabKey, string>;

export function AppShell() {
  const { logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [session, setSession] = useState<MobileSessionInfo | null>(null);

  useEffect(() => {
    api.getMe().then(setSession).catch(() => {
      // The sidebar footer just falls back to a generic label — not worth failing the whole shell
      // over a display-only nicety.
    });
  }, []);

  function handleSignOut() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-cream-dark">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-navy px-4 py-4 text-white">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="grid size-8 place-items-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <img src="/BLUE_LEDGER.png" alt="" className="size-6" />
        <span className="font-display text-sm">{TAB_LABELS[activeTab]}</span>
      </header>

      <Sidebar
        open={drawerOpen}
        activeTab={activeTab}
        employeeName={session?.employeeName ?? "Owner"}
        roleName={session?.roleName ?? "Super Admin"}
        onSelect={setActiveTab}
        onClose={() => setDrawerOpen(false)}
        onSignOut={handleSignOut}
      />

      <AnimatePresence mode="wait">
        <motion.main
          key={activeTab}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "dashboard" && <DashboardTab />}
          {activeTab === "employees" && <EmployeesTab currency={session?.currency ?? "KES"} />}
          {activeTab === "sales" && <SalesTab />}
          {activeTab === "invoices" && <InvoicesTab />}
          {activeTab === "quotations" && <QuotationsTab />}
          {activeTab === "transactions" && <TransactionsTab />}
          {activeTab === "products" && <ProductsTab />}
          {activeTab === "purchases" && <PurchasesTab />}
          {activeTab === "expenses" && <ExpensesTab />}
          {activeTab === "stockLedger" && <StockLedgerTab />}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
