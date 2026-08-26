import type { MobileSessionInfo } from "./types";

export type DashboardVariant = "admin" | "cashier" | "storekeeper";

/**
 * Ports DESKTOP's own dashboard-role.ts — role NAME is checked first, before anything else,
 * because a Cashier or Storekeeper can legitimately have no branch assigned (a Storekeeper left
 * unassigned specifically to see stock across every storefront) and that must not bump them up
 * into the unrestricted Admin layout, which assumes full sales/financial permissions they don't
 * have. Unlike DESKTOP, mobile collapses Super Admin and Manager into one "admin" variant — every
 * mobile dashboard query is already branch-scoped via locationId for a non-Super-Admin, so the two
 * roles already see correctly-scoped data from the exact same widgets with zero extra branching
 * needed (DESKTOP's own SuperAdminDashboard/ManagerDashboard are themselves just one shared
 * BusinessDashboard component with a boolean prop, for the same reason).
 */
export function getDashboardVariant(session: MobileSessionInfo | null): DashboardVariant {
  if (!session) return "admin";
  const roleName = session.roleName?.trim().toLowerCase();
  if (roleName === "cashier") return "cashier";
  if (roleName === "storekeeper") return "storekeeper";
  return "admin";
}
