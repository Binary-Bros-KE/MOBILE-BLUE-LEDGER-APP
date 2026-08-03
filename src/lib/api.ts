import type {
  Employee,
  ExpenseListItem,
  InvoiceListItem,
  MobileCustomer,
  MobileLocation,
  MobilePeriod,
  MobileSessionInfo,
  MobileTaxReport,
  OwnerDashboard,
  ProductListItem,
  PurchaseDetail,
  PurchaseListItem,
  QuotationListItem,
  Salary,
  SaleListItem,
  SalesReportBreakdowns,
  SalesReportOverview,
  SalesReportPeriodInput,
  SalesTrendResult,
  ShareDocumentEntity,
  SharedDocument,
  SharedStatement,
  ShareLinkResult,
  StockMovementRow,
  TransactionRow,
} from "./types";
import { timezoneOffsetMinutes } from "./period";

// The only place this app knows the API's address — change NEXT_PUBLIC_API_URL in .env.local
// (or the real deployment env) and nothing else needs to change.
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const TOKEN_STORAGE_KEY = "bl_owner_token";
// Deliberately a SEPARATE key from the session token, and never cleared on logout — the whole
// point is that a license key is a one-time "which business is this phone for" fact, not part of
// any one person's session. Logging out should only ever ask for employee code + PIN again.
export const LICENSE_KEY_STORAGE_KEY = "bl_owner_license_key";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/** A 401 means the token is missing/expired/invalid, or the Owner App permission/employee status
 * changed server-side since login (requireOwnerAppAccess re-checks live on every request) — either
 * way there's no refresh flow, so the only correct move is to drop it and send the user back to
 * login. A hard reload guarantees every bit of stale in-memory state (AuthProvider included) resets
 * cleanly. */
function handleUnauthorized(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new ApiError(0, "NEXT_PUBLIC_API_URL is not configured — check .env.local");
  }

  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const body = await res.json().catch(() => null);

  if (res.status === 401) {
    handleUnauthorized();
    throw new ApiError(401, body?.error ?? "Session expired");
  }

  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  }

  return body as T;
}

// timezoneOffsetMinutes is appended here (not required on the caller-supplied SalesReportPeriodInput
// itself) so every call site gets it for free — SERVER resolves "today"/"this week"/etc. against
// THIS value, never the tenant's stored business-record timezone.
function periodQuery(period: SalesReportPeriodInput): string {
  const tz = `timezoneOffsetMinutes=${timezoneOffsetMinutes()}`;
  if (period.mode === "custom") {
    return `mode=custom&startDate=${encodeURIComponent(period.startDate)}&endDate=${encodeURIComponent(period.endDate)}&${tz}`;
  }
  return `mode=${period.mode}&anchor=${encodeURIComponent(period.anchor)}&${tz}`;
}

export const api = {
  login: (licenseKey: string, employeeCode: string, pin: string) =>
    request<{ token: string }>("/mobile/login", {
      method: "POST",
      body: JSON.stringify({ licenseKey, employeeCode, pin }),
    }),
  getDashboard: (period: MobilePeriod) =>
    request<OwnerDashboard>(`/mobile/dashboard?period=${period}&timezoneOffsetMinutes=${timezoneOffsetMinutes()}`),
  getMe: () => request<MobileSessionInfo>("/mobile/me"),
  listEmployees: () => request<Employee[]>("/mobile/employees"),
  getEmployeeSalaries: (employeeId: string) => request<Salary[]>(`/mobile/employees/${employeeId}/salaries`),
  listLocations: () => request<MobileLocation[]>("/mobile/locations"),
  listSales: (locationId?: string) =>
    request<SaleListItem[]>(`/mobile/sales${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  getSale: (id: string) => request<SharedDocument>(`/mobile/sales/${id}`),
  listInvoices: (locationId?: string) =>
    request<InvoiceListItem[]>(`/mobile/invoices${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  listCustomers: () => request<MobileCustomer[]>("/mobile/customers"),
  getStatement: (customerId: string) => request<SharedStatement>(`/mobile/customers/${customerId}/statement`),
  listQuotations: (locationId?: string) =>
    request<QuotationListItem[]>(`/mobile/quotations${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  getQuotation: (id: string) => request<SharedDocument>(`/mobile/quotations/${id}`),
  listTransactions: (locationId?: string) =>
    request<TransactionRow[]>(`/mobile/transactions${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  listProducts: () => request<ProductListItem[]>("/mobile/products"),
  listPurchases: (locationId?: string) =>
    request<PurchaseListItem[]>(`/mobile/purchases${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  getPurchase: (id: string) => request<PurchaseDetail>(`/mobile/purchases/${id}`),
  listExpenses: (locationId?: string) =>
    request<ExpenseListItem[]>(`/mobile/expenses${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  listStockMovements: (locationId?: string) =>
    request<StockMovementRow[]>(`/mobile/stock-ledger${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  getSalesReportOverview: (period: SalesReportPeriodInput) => request<SalesReportOverview>(`/mobile/sales-report/overview?${periodQuery(period)}`),
  getSalesTrend: (period: SalesReportPeriodInput) => request<SalesTrendResult>(`/mobile/sales-report/trend?${periodQuery(period)}`),
  getSalesBreakdowns: (period: SalesReportPeriodInput) => request<SalesReportBreakdowns>(`/mobile/sales-report/breakdowns?${periodQuery(period)}`),
  getSalesTaxBreakdown: (period: SalesReportPeriodInput) => request<MobileTaxReport>(`/mobile/sales-report/tax?${periodQuery(period)}`),
  createShareLink: (entity: ShareDocumentEntity, entityId: string, includePreview: boolean) =>
    request<ShareLinkResult>("/mobile/share-links", {
      method: "POST",
      body: JSON.stringify({ entity, entityId, includePreview }),
    }),
};

/** The actual PDF file — a plain cross-origin link (not a fetch), so this is a real file download
 * that never navigates the page away, which matters inside an installed PWA (see SalesTab's own
 * notes on why the Owner App doesn't redirect to the SHARE app for anything). */
export function getShareDownloadUrl(token: string): string {
  return `${API_URL}/share/${token}/download`;
}
