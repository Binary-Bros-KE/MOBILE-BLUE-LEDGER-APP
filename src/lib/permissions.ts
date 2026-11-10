/** Every permission module, in DESKTOP's own order and wording (shared/types/role.ts
 * PERMISSION_MODULES) — what the Roles & Permissions toggles show. SERVER validates against its own
 * copy, so a stray key here could never be saved. */
export const PERMISSION_MODULES = [
  { key: "dashboard", label: "Dashboard", actions: ["view"] },
  { key: "products", label: "Products", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "categories", label: "Categories", actions: ["view", "create", "edit", "delete"] },
  { key: "inventory", label: "Inventory", actions: ["view", "create", "edit", "export"] },
  { key: "main_store", label: "Main Store", actions: ["view", "create", "edit", "export"] },
  { key: "stock_transfers", label: "Stock Transfers", actions: ["view", "create", "approve", "export"] },
  { key: "sales", label: "Sales", actions: ["view", "create", "edit", "delete", "approve", "export"] },
  { key: "quotations", label: "Quotations", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "purchases", label: "Purchases", actions: ["view", "create", "edit", "delete", "approve", "export"] },
  { key: "customers", label: "Customers", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "suppliers", label: "Suppliers", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "riders", label: "Riders", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "stock_requests", label: "Stock Requests", actions: ["view", "create", "approve", "export"] },
  { key: "purchase_requisitions", label: "Purchase Requisitions", actions: ["view", "create", "approve"] },
  { key: "expenses", label: "Expenses", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "expense_categories", label: "Expense Categories", actions: ["view", "create", "edit", "delete"] },
  { key: "local_purchases", label: "Local Purchases", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "local_credit_purchases", label: "Local Credit Purchases (Edit = receive goods)", actions: ["view", "create", "edit"] },
  { key: "borrows", label: "Borrow & Lend", actions: ["view", "create", "edit", "export"] },
  { key: "employees", label: "Employees", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "salaries", label: "Salaries", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "roles", label: "Roles", actions: ["view", "create", "edit", "delete"] },
  { key: "reports", label: "Reports", actions: ["view", "export"] },
  { key: "settings", label: "Settings", actions: ["view", "edit"] },
  { key: "business_profile", label: "Business Profile", actions: ["view", "edit"] },
  { key: "locations", label: "Locations", actions: ["view", "create", "edit", "delete"] },
  { key: "payment_methods", label: "Payment Methods", actions: ["view", "create", "edit", "delete"] },
  { key: "approvals", label: "Approvals", actions: ["view", "approve"] },
  { key: "cloud_sync", label: "Cloud Sync", actions: ["view", "edit"] },
  { key: "data_import", label: "Data Import", actions: ["view", "edit"] },
  { key: "owner_app", label: "Owner Mobile App", actions: ["view"] },
  { key: "online_store", label: "Online Store", actions: ["view", "edit"] },
  { key: "administration", label: "Administration", actions: ["view", "edit"] },
] as const;

export const PERMISSION_ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  export: "Export",
};

export type PermissionsMap = Record<string, string[]>;

/** Same comparison either way round — for "is this role still on its defaults?". */
export function samePermissions(a: PermissionsMap, b: PermissionsMap): boolean {
  return PERMISSION_MODULES.every((module) => {
    const left = [...(a[module.key] ?? [])].sort().join(",");
    const right = [...(b[module.key] ?? [])].sort().join(",");
    return left === right;
  });
}
