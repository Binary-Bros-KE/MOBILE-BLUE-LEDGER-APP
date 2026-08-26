import type {
  CheckoutRequest,
  CheckoutResult,
  ConvertToInvoiceRequest,
  ConvertToSaleRequest,
  CreateCustomerInput,
  CreateInvoiceRequest,
  CreateQuotationRequest,
  CreateRiderInput,
  CreateSupplierInput,
  DocumentIdResult,
  Employee,
  ExpenseListItem,
  InvoiceCancellationApprovalItem,
  InvoiceListItem,
  MarkPaidRequest,
  MobileCustomer,
  MobileInvoiceEditData,
  MobileLocation,
  MobilePeriod,
  MobileQuotationEditData,
  MobileRider,
  MobileSessionInfo,
  MobileSupplier,
  MobileTaxReport,
  OwnerDashboard,
  PaymentMethodOption,
  ProductListItem,
  PurchaseDetail,
  PurchaseListItem,
  QuotationListItem,
  QuotationStatusValue,
  QuotationStockCheckItem,
  RecordPaymentRequest,
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
  WorkingHoursListItem,
  WorkingHoursConfig,
  WorkingHoursUpsertInput,
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
  /** Set only when SERVER's error body includes one (see SERVER's HttpError) — lets a call site
   * tell a specific error apart from an ordinary same-status failure without string-matching
   * `message`. Currently only "WORKING_HOURS_LOCKED" sets this. */
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
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

/** A 403 with this code means the system is locked outside working hours (see SERVER's
 * requireOwnerAppAccess) — unlike handleUnauthorized, the session itself is still valid and
 * temporarily blocked, not expired, so the token is deliberately NOT cleared here. The /locked page
 * self-polls and redirects back once it's no longer locked. */
function handleWorkingHoursLocked(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/locked" && window.location.pathname !== "/login") {
    window.location.href = "/locked";
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

  if (res.status === 403 && body?.code === "WORKING_HOURS_LOCKED") {
    handleWorkingHoursLocked();
    throw new ApiError(403, body?.error ?? "This system is locked outside working hours", body.code);
  }

  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, body?.code);
  }

  return body as T;
}

// timezoneOffsetMinutes is appended here (not required on the caller-supplied SalesReportPeriodInput
// itself) so every call site gets it for free — SERVER resolves "today"/"this week"/etc. against
// THIS value, never the tenant's stored business-record timezone.
function periodQuery(period: SalesReportPeriodInput, locationId?: string): string {
  const tz = `timezoneOffsetMinutes=${timezoneOffsetMinutes()}`;
  const loc = locationId ? `&locationId=${encodeURIComponent(locationId)}` : "";
  if (period.mode === "custom") {
    return `mode=custom&startDate=${encodeURIComponent(period.startDate)}&endDate=${encodeURIComponent(period.endDate)}&${tz}${loc}`;
  }
  return `mode=${period.mode}&anchor=${encodeURIComponent(period.anchor)}&${tz}${loc}`;
}

export const api = {
  login: (licenseKey: string, employeeCode: string, pin: string) =>
    request<{ token: string }>("/mobile/login", {
      method: "POST",
      body: JSON.stringify({ licenseKey, employeeCode, pin }),
    }),
  getDashboard: (period: MobilePeriod, locationId?: string) =>
    request<OwnerDashboard>(
      `/mobile/dashboard?period=${period}&timezoneOffsetMinutes=${timezoneOffsetMinutes()}${locationId ? `&locationId=${encodeURIComponent(locationId)}` : ""}`,
    ),
  getMe: () => request<MobileSessionInfo>("/mobile/me"),
  listEmployees: () => request<Employee[]>("/mobile/employees"),
  getEmployeeSalaries: (employeeId: string) => request<Salary[]>(`/mobile/employees/${employeeId}/salaries`),
  listLocations: () => request<MobileLocation[]>("/mobile/locations"),
  /** Active, storefront-type locations only — backs Checkout's StorefrontPicker for a branch-less
   * employee, unlike listLocations above (which includes every location, for report filter chips). */
  listStorefronts: () => request<MobileLocation[]>("/mobile/storefronts"),
  listSales: (locationId?: string) =>
    request<SaleListItem[]>(`/mobile/sales${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  getSale: (id: string) => request<SharedDocument>(`/mobile/sales/${id}`),
  listInvoices: (locationId?: string) =>
    request<InvoiceListItem[]>(`/mobile/invoices${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  createInvoice: (body: CreateInvoiceRequest) => request<DocumentIdResult>("/mobile/invoices", { method: "POST", body: JSON.stringify(body) }),
  getInvoiceEditData: (id: string) => request<MobileInvoiceEditData>(`/mobile/invoices/${id}/edit`),
  updateInvoice: (id: string, body: CreateInvoiceRequest) => request<DocumentIdResult>(`/mobile/invoices/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  recordInvoicePayment: (id: string, body: RecordPaymentRequest) =>
    request<DocumentIdResult>(`/mobile/invoices/${id}/payments`, { method: "POST", body: JSON.stringify(body) }),
  markInvoicePaid: (id: string, body: MarkPaidRequest) =>
    request<DocumentIdResult>(`/mobile/invoices/${id}/mark-paid`, { method: "POST", body: JSON.stringify(body) }),
  duplicateInvoice: (id: string) => request<DocumentIdResult>(`/mobile/invoices/${id}/duplicate`, { method: "POST" }),
  cancelInvoice: (id: string, reason?: string) =>
    request<DocumentIdResult>(`/mobile/invoices/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  requestInvoiceCancellation: (id: string, body: { reason: string; notes?: string }) =>
    request<DocumentIdResult>(`/mobile/invoices/${id}/request-cancel`, { method: "POST", body: JSON.stringify(body) }),
  listPendingInvoiceCancellations: () => request<InvoiceCancellationApprovalItem[]>("/mobile/approvals/invoice-cancellations"),
  approveInvoiceCancellation: (id: string, notes?: string) =>
    request<DocumentIdResult>(`/mobile/approvals/invoice-cancellations/${id}/approve`, { method: "POST", body: JSON.stringify({ notes }) }),
  rejectInvoiceCancellation: (id: string, notes?: string) =>
    request<DocumentIdResult>(`/mobile/approvals/invoice-cancellations/${id}/reject`, { method: "POST", body: JSON.stringify({ notes }) }),
  listCustomers: () => request<MobileCustomer[]>("/mobile/customers"),
  createCustomer: (body: CreateCustomerInput) =>
    request<MobileCustomer>("/mobile/customers", { method: "POST", body: JSON.stringify(body) }),
  getStatement: (customerId: string) => request<SharedStatement>(`/mobile/customers/${customerId}/statement`),
  listRiders: () => request<MobileRider[]>("/mobile/riders"),
  createRider: (body: CreateRiderInput) => request<MobileRider>("/mobile/riders", { method: "POST", body: JSON.stringify(body) }),
  listSuppliers: () => request<MobileSupplier[]>("/mobile/suppliers"),
  createSupplier: (body: CreateSupplierInput) =>
    request<MobileSupplier>("/mobile/suppliers", { method: "POST", body: JSON.stringify(body) }),
  listQuotations: (locationId?: string) =>
    request<QuotationListItem[]>(`/mobile/quotations${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  getQuotation: (id: string) => request<SharedDocument>(`/mobile/quotations/${id}`),
  createQuotation: (body: CreateQuotationRequest) => request<DocumentIdResult>("/mobile/quotations", { method: "POST", body: JSON.stringify(body) }),
  getQuotationEditData: (id: string) => request<MobileQuotationEditData>(`/mobile/quotations/${id}/edit`),
  updateQuotation: (id: string, body: CreateQuotationRequest) =>
    request<DocumentIdResult>(`/mobile/quotations/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteQuotation: (id: string) => request<DocumentIdResult>(`/mobile/quotations/${id}`, { method: "DELETE" }),
  setQuotationStatus: (id: string, status: QuotationStatusValue) =>
    request<DocumentIdResult>(`/mobile/quotations/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  checkQuotationStock: (id: string) => request<QuotationStockCheckItem[]>(`/mobile/quotations/${id}/stock-check`),
  convertQuotationToSale: (id: string, body: ConvertToSaleRequest) =>
    request<DocumentIdResult>(`/mobile/quotations/${id}/convert-to-sale`, { method: "POST", body: JSON.stringify(body) }),
  convertQuotationToInvoice: (id: string, body: ConvertToInvoiceRequest) =>
    request<DocumentIdResult>(`/mobile/quotations/${id}/convert-to-invoice`, { method: "POST", body: JSON.stringify(body) }),
  listTransactions: (locationId?: string) =>
    request<TransactionRow[]>(`/mobile/transactions${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  listProducts: () => request<ProductListItem[]>("/mobile/products"),
  listPaymentMethods: () => request<PaymentMethodOption[]>("/mobile/payment-methods"),
  /** Real, from-scratch checkout — SERVER recomputes every figure itself (see
   * mobile-checkout-service.ts), this body is a proposal, not a trusted total. `body.id` must be
   * minted client-side (crypto.randomUUID()) and resent UNCHANGED on any retry — that's the whole
   * idempotency mechanism, a retried id is a safe no-op rather than a second sale. */
  checkout: (body: CheckoutRequest) => request<CheckoutResult>("/mobile/sales", { method: "POST", body: JSON.stringify(body) }),
  listPurchases: (locationId?: string) =>
    request<PurchaseListItem[]>(`/mobile/purchases${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  getPurchase: (id: string) => request<PurchaseDetail>(`/mobile/purchases/${id}`),
  listExpenses: (locationId?: string) =>
    request<ExpenseListItem[]>(`/mobile/expenses${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  listStockMovements: (locationId?: string) =>
    request<StockMovementRow[]>(`/mobile/stock-ledger${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
  getSalesReportOverview: (period: SalesReportPeriodInput, locationId?: string) =>
    request<SalesReportOverview>(`/mobile/sales-report/overview?${periodQuery(period, locationId)}`),
  getSalesTrend: (period: SalesReportPeriodInput, locationId?: string) =>
    request<SalesTrendResult>(`/mobile/sales-report/trend?${periodQuery(period, locationId)}`),
  getSalesBreakdowns: (period: SalesReportPeriodInput, locationId?: string) =>
    request<SalesReportBreakdowns>(`/mobile/sales-report/breakdowns?${periodQuery(period, locationId)}`),
  getSalesTaxBreakdown: (period: SalesReportPeriodInput, locationId?: string) =>
    request<MobileTaxReport>(`/mobile/sales-report/tax?${periodQuery(period, locationId)}`),
  createShareLink: (entity: ShareDocumentEntity, entityId: string, includePreview: boolean) =>
    request<ShareLinkResult>("/mobile/share-links", {
      method: "POST",
      body: JSON.stringify({ entity, entityId, includePreview }),
    }),
  listWorkingHours: () => request<WorkingHoursListItem[]>("/mobile/working-hours"),
  getWorkingHours: (locationId: string) => request<WorkingHoursConfig | null>(`/mobile/working-hours/${locationId}`),
  saveWorkingHours: (locationId: string, body: WorkingHoursUpsertInput) =>
    request<WorkingHoursConfig>(`/mobile/working-hours/${locationId}`, { method: "PUT", body: JSON.stringify(body) }),
  toggleManualLock: (locationId: string, locked: boolean) =>
    request<WorkingHoursConfig>(`/mobile/working-hours/${locationId}/toggle-manual-lock`, { method: "POST", body: JSON.stringify({ locked }) }),
};

/** The actual PDF file — a plain cross-origin link (not a fetch), so this is a real file download
 * that never navigates the page away, which matters inside an installed PWA (see SalesTab's own
 * notes on why the Owner App doesn't redirect to the SHARE app for anything). */
export function getShareDownloadUrl(token: string): string {
  return `${API_URL}/share/${token}/download`;
}
