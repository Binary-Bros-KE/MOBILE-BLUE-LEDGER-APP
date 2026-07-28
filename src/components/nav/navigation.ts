import {
  ArrowLeftRight,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type TabKey =
  | "dashboard"
  | "sales"
  | "invoices"
  | "quotations"
  | "transactions"
  | "products"
  | "purchases"
  | "expenses"
  | "stockLedger"
  | "employees";

export type NavItem = {
  key: TabKey;
  label: string;
  icon: LucideIcon;
  ready: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true }],
  },
  {
    title: "Sales",
    items: [
      // "Sales" covers what DESKTOP calls Receipts (a walk-in, non-invoice Sale) — no separate
      // Receipts tab, they're the same underlying document.
      { key: "sales", label: "Sales", icon: ShoppingCart, ready: true },
      // "Invoices" also carries the "Statement" action (see InvoicesTab.tsx) — same as DESKTOP's
      // own InvoicesRoute, no separate Statements nav entry.
      { key: "invoices", label: "Invoices", icon: FileText, ready: true },
      { key: "quotations", label: "Quotations", icon: FileSpreadsheet, ready: true },
      { key: "transactions", label: "Transactions", icon: ArrowLeftRight, ready: true },
    ],
  },
  {
    title: "Inventory & Costs",
    items: [
      { key: "products", label: "Products", icon: Package, ready: true },
      { key: "purchases", label: "Purchases", icon: Truck, ready: true },
      { key: "expenses", label: "Expenses", icon: Wallet, ready: true },
      { key: "stockLedger", label: "Stock Ledger", icon: Warehouse, ready: true },
    ],
  },
  {
    title: "Team",
    items: [{ key: "employees", label: "Employees", icon: Users, ready: true }],
  },
];
