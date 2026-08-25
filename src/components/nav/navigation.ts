import {
  ArrowLeftRight,
  CreditCard,
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
  | "checkout"
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
  /** Module+action this tab requires beyond the base owner_app.view every signed-in employee
   * already has — same vocabulary as DESKTOP's own PermissionsMap (see Sidebar/AppShell, which
   * filter navGroups against the signed-in employee's actual permissions from /mobile/me). Omit for
   * a tab visible to anyone who can open the app at all (just Dashboard today). */
  permission?: { module: string; action: string };
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
      // Same permission DESKTOP's own completeSale() checks — granting a role mobile checkout
      // access is just a normal Roles & Permissions edit, nothing mobile-specific to configure.
      { key: "checkout", label: "Checkout", icon: CreditCard, ready: true, permission: { module: "sales", action: "create" } },
      // "Sales" covers what DESKTOP calls Receipts (a walk-in, non-invoice Sale) — no separate
      // Receipts tab, they're the same underlying document.
      { key: "sales", label: "Sales", icon: ShoppingCart, ready: true, permission: { module: "sales", action: "view" } },
      // "Invoices" also carries the "Statement" action (see InvoicesTab.tsx) — same as DESKTOP's
      // own InvoicesRoute, no separate Statements nav entry. Invoices are just Sales with an
      // invoiceNumber set — DESKTOP gates them under the same "sales" permission, not a distinct one.
      { key: "invoices", label: "Invoices", icon: FileText, ready: true, permission: { module: "sales", action: "view" } },
      { key: "quotations", label: "Quotations", icon: FileSpreadsheet, ready: true, permission: { module: "quotations", action: "view" } },
      { key: "transactions", label: "Transactions", icon: ArrowLeftRight, ready: true, permission: { module: "reports", action: "view" } },
    ],
  },
  {
    title: "Inventory & Costs",
    items: [
      { key: "products", label: "Products", icon: Package, ready: true, permission: { module: "products", action: "view" } },
      { key: "purchases", label: "Purchases", icon: Truck, ready: true, permission: { module: "purchases", action: "view" } },
      { key: "expenses", label: "Expenses", icon: Wallet, ready: true, permission: { module: "expenses", action: "view" } },
      { key: "stockLedger", label: "Stock Ledger", icon: Warehouse, ready: true, permission: { module: "inventory", action: "view" } },
    ],
  },
  {
    title: "Team",
    items: [{ key: "employees", label: "Employees", icon: Users, ready: true, permission: { module: "employees", action: "view" } }],
  },
];

/** Filters navGroups against the signed-in employee's actual permissions (from /mobile/me) — a tab
 * with no `permission` requirement (just Dashboard today) is always visible; every other tab needs
 * its own module+action present. Drops any group left with zero visible items entirely, so an empty
 * "Team" heading never shows for a role with no employees.view. */
export function visibleNavGroups(permissions: Record<string, string[]> | null | undefined): NavGroup[] {
  const perms = permissions ?? {};
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || (perms[item.permission.module]?.includes(item.permission.action) ?? false)),
    }))
    .filter((group) => group.items.length > 0);
}
