export type MobilePeriod = "today" | "week" | "month";

export type PaymentMethodBreakdownEntry = {
  paymentMethodName: string;
  revenueCents: number;
  transactionCount: number;
  percentOfTotal: number;
};

export type SalesTopProduct = {
  productId: string;
  productName: string;
  quantitySold: number;
  revenueCents: number;
};

/** One row of the Sales Report's "Products Sold" list (DESKTOP's SalesProductSold). */
export type SalesProductSold = SalesTopProduct & {
  unitOfMeasure: string | null;
  costCents: number;
  marginCents: number;
  marginPercent: number;
  percentOfRevenue: number;
};

export type SalesSnapshot = {
  revenueCents: number;
  transactionCount: number;
  paymentMethodBreakdown: PaymentMethodBreakdownEntry[];
  topProducts: SalesTopProduct[];
};

export type ExpensesAndProfit = {
  expensesCents: number;
  purchasesPaidCents: number;
  salariesPaidCents: number;
  serviceChargeCostsCents: number;
  totalExpensesCents: number;
  netRevenueCents: number;
  netProfitCents: number;
};

export type StockAlertProduct = { productId: string; productName: string; quantity: number; reorderLevel: number };

export type StockAlerts = {
  lowStockCount: number;
  outOfStockCount: number;
  lowStockProducts: StockAlertProduct[];
  outOfStockProducts: { productId: string; productName: string }[];
};

export type CustomerOverLimit = {
  customerId: string;
  customerName: string;
  outstandingCents: number;
  creditLimitCents: number;
};

export type OutstandingCredit = {
  totalOutstandingCents: number;
  debtorCount: number;
  customersOverLimit: CustomerOverLimit[];
};

export type OwnerDashboard = {
  period: MobilePeriod;
  periodStart: string;
  periodEnd: string;
  currency: string;
  sales: SalesSnapshot;
  expensesAndProfit: ExpensesAndProfit;
  stock: StockAlerts;
  credit: OutstandingCredit;
  /** The signed-in employee's own sales, same SalesSnapshot shape as `sales` above but scoped to
   * them — powers the Cashier dashboard variant's personal stat cards. */
  mySales: SalesSnapshot | null;
  /** The individual transactions behind mySales — most recent first, capped at 20. Powers the
   * Cashier dashboard variant's "My sales today" activity list. */
  myRecentSales: MyRecentSale[] | null;
  /** Distinct sales, storefront-scoped, with a void or return request still pending today —
   * intentionally not a money figure, so it's fine to show on the Cashier dashboard too. */
  pendingApprovalsToday: number;
};

export type MyRecentSale = {
  id: string;
  documentNumber: string | null;
  occurredAt: string;
  amountCents: number;
};

export type MobileSessionInfo = {
  /** Lets the Employees tab tell "this is you" apart — own PIN change allowed, own status/role
   * change blocked (SERVER enforces the same in mobile-employees-service.ts). */
  employeeId: string;
  employeeName: string;
  roleName: string | null;
  currency: string;
  /** Module -> allowed actions, same shape as DESKTOP's own PermissionsMap — gates which tabs/
   * actions this employee sees. A module absent means no access, same convention as DESKTOP. */
  permissions: Record<string, string[]>;
  /** This employee's own assigned branch — null for a branch-less employee. Checkout resolves
   * "which storefront am I selling from" from this, no picker (mobile checkout is always scoped to
   * the signed-in employee's own branch in this phase). */
  branchId: string | null;
  branchName: string | null;
  /** Pre-fills the "Include storefront information" checkbox's initial value on a brand-new sale/
   * invoice/quotation — see SERVER's Location["defaultIncludeBusinessInfo"] doc comment. Null for a
   * branch-less employee; every create form falls back to true in that case. */
  defaultIncludeBusinessInfo: boolean | null;
  /** Tenant-wide tax defaults — Checkout needs these alongside each product's own pricesTaxInclusive
   * override (see ProductListItem) to compute the real tax-inclusive total, matching what SERVER
   * enforces authoritatively at submit time. */
  vatRatePercent: number;
  pricesTaxInclusive: boolean;
  /** Business Profile "Editing existing invoices: Disabled" — hides the Edit Invoice button; SERVER
   * rejects the edit call regardless. */
  invoiceEditsDisabled: boolean;
  /** Admin "Invoice stock from Main Store" toggle — shows the Stock From picker on invoices and on
   * Convert to Invoice; SERVER refuses a Main Store invoice regardless when it's off. */
  invoiceStockFromMainStore: boolean;
  /** Server-authoritative — see SERVER's Role.isSuperAdmin doc comment. Gates the Working Hours tab
   * (view AND edit are Super-Admin-exclusive, not a delegable module/action permission). */
  isSuperAdmin: boolean;
};

export type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  alternativePhone: string | null;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  hireDate: string | null;
  status: string;
  roleId: string | null;
  branchId: string | null;
  roleName: string | null;
  /** This employee's role is THE Super Admin role — only another Super Admin may change their access. */
  isSuperAdmin: boolean;
  branchName: string | null;
};

/** Mirrors DESKTOP's EMPLOYEE_STATUS_OPTIONS. */
export type EmployeeStatusValue = "active" | "suspended" | "terminated";

export type MobileRole = { id: string; roleName: string; isSuperAdmin: boolean };

/** The optional profile fields (DESKTOP's Employee form minus photo/salary defaults). */
export type EmployeeProfileInput = {
  middleName: string | null;
  gender: "female" | "male" | "other" | null;
  dateOfBirth: string | null;
  alternativePhone: string | null;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  hireDate: string | null;
};

export type CreateEmployeeInput = Partial<EmployeeProfileInput> & {
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId: string;
  branchId: string | null;
  pin: string;
};

/** Body for PATCH /mobile/employees/:id/details — the whole profile at once. */
export type UpdateEmployeeDetailsInput = EmployeeProfileInput & {
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone: string | null;
};

/** Every field optional — Suspend/Reactivate sends just `status`, Edit Access sends role + branch. */
export type UpdateEmployeeAccessInput = {
  roleId?: string;
  branchId?: string | null;
  status?: EmployeeStatusValue;
};

export type SalaryLineItem = { name: string; amountCents: number };

export type Salary = {
  id: string;
  payslipNumber: string;
  payPeriod: string;
  basicSalaryCents: number;
  allowances: SalaryLineItem[];
  deductions: SalaryLineItem[];
  allowancesCents: number;
  deductionsCents: number;
  netPayCents: number;
  paymentMethodName: string | null;
  paymentReference: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
};

/** `locationType` comes back from /mobile/locations only ("distribution_center" = the Main Store). */
export type MobileLocation = { id: string; locationName: string; locationType?: string };

/** Mirrors SERVER's SaleStatusFlags (mobile-sales-service.ts) exactly — a completed sale can
 * independently have a void request and a return request, each with its own approved/pending/
 * rejected lifecycle. Void/return only apply to receipts, same as DESKTOP. */
export type SaleStatusFlags = {
  approvedVoid: boolean;
  pendingVoid: boolean;
  rejectedVoid: boolean;
  approvedReturn: boolean;
  pendingReturn: boolean;
  rejectedReturn: boolean;
};

export type SaleListItem = SaleStatusFlags & {
  id: string;
  receiptNumber: string | null;
  customerName: string | null;
  employeeName: string;
  locationName: string;
  locationId: string;
  paymentMethodName: string | null;
  itemCount: number;
  grandTotalCents: number;
  saleStatus: string;
  completedAt: string | null;
  createdAt: string;
  hasDeliveryNote: boolean;
  deliveryIsDelivered: boolean | null;
  currency: string;
};

/** Mirrors SERVER's SharedDocumentResult (share-service.ts) exactly — same view-model the Share
 * feature's public page and DESKTOP's own downloaded PDF both render from, reused here verbatim so
 * the Owner App's document view can never show different numbers. */
export type SharedLineItem = {
  name: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  discountAmountCents: number;
  taxAmountCents: number;
  lineTotalCents: number;
  /** Client request: groups this line under a named section (e.g. "Lighting") on the document —
   * null for every service-charge/delivery-fee line and for any product line that never opted
   * into a section. Mirrors SERVER's SharedLineItem["sectionLabel"]. */
  sectionLabel: string | null;
};

/** One titled free-text block below an invoice/quotation's items (e.g. "Installation
 * Instructions") — mirrors SERVER's SharedNotesSection. */
export type SharedNotesSection = {
  title: string;
  body: string;
};

export type SharedPayment = {
  receivedAt: string;
  paymentMethodName: string;
  reference: string | null;
  receivedByName: string;
  amountCents: number;
};

export type PricedDocumentKind = "receipt" | "invoice" | "quotation";

export type TaxType = "vat" | "exempted" | "zero_rated";

export type TaxPricingMode = "inclusive" | "exclusive";

export type TaxBreakdownEntry = {
  taxType: TaxType;
  /** Which pricing mode this row's lines used — "vat" splits into a separate row per mode present.
   * Always null for exempted/zero-rated. */
  pricingMode: TaxPricingMode | null;
  netCents: number;
  taxCents: number;
  grossCents: number;
};

export type SharedDocument = Partial<SaleStatusFlags> & {
  documentKind: PricedDocumentKind;
  businessName: string;
  physicalAddress: string | null;
  primaryPhone: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  currency: string;
  documentNumber: string | null;
  dateLabel: string;
  employeeName: string;
  branchName: string;
  customerName: string | null;
  items: SharedLineItem[];
  extraLines: SharedLineItem[];
  subtotalCents: number;
  discountAmountCents: number;
  taxAmountCents: number;
  /** The subset of taxAmountCents actually ADDED to reach grandTotalCents (exclusive-priced lines
   * only) — what the "Total Tax" summary row shows, computed once server-side. */
  addedTaxCents: number;
  taxBreakdown: TaxBreakdownEntry[];
  /** Whether the Tax Breakdown section should actually render on this document — see SERVER's
   * Sale/Quotation Prisma model doc comment for the same field. taxBreakdown itself is always
   * present regardless. */
  includeTaxBreakdown: boolean;
  /** Whether this document shows ANY shop identity — see SERVER's Sale/Quotation Prisma model doc
   * comment for the same field. When false, businessName/etc. already come through as a generic
   * heading with everything else null/empty — this flag itself isn't needed by any render logic
   * here, just carried through for type parity with SERVER's SharedDocumentResult. */
  includeBusinessInfo: boolean;
  /** Whether this document has a delivery note attached — gates the "View Delivery Note" button on
   * DocumentDetailModal, same signal SERVER's SharedDocumentResult carries. */
  hasDeliveryNote: boolean;
  /** Null when hasDeliveryNote is false. */
  deliveryIsDelivered: boolean | null;
  vatRatePercent: number;
  grandTotalCents: number;
  paymentMethodName: string | null;
  paymentReference: string | null;
  amountReceivedCents: number | null;
  changeGivenCents: number | null;
  payments: SharedPayment[];
  transactionType: string | null;
  notes: string | null;
  /** Client request: any number of additional titled note blocks below notes — see
   * SharedNotesSection's own doc comment. Defaults to []. */
  notesSections: SharedNotesSection[];
  dueDate: string | null;
  balanceDueCents: number | null;
  paymentStatus: string | null;
  validUntil: string | null;
  quotationStatus: string | null;
};

export type ShareDocumentEntity = "sale" | "quotation" | "customer_statement" | "sale_delivery" | "quotation_delivery";

/** The customer a document is shared to — pre-fills the Share sheet (mobile /share-recipient). */
export type ShareRecipient = { name: string | null; phone: string | null; email: string | null };

export type ShareLinkResult = { url: string; message: string };

/** Non-pricing view-model for an attached delivery note — mirrors SERVER's SharedDeliveryNoteResult
 * exactly (see share-service.ts's own doc comment for why it carries no fee/cost figures). */
export type MobileDeliveryNote = {
  documentKind: "delivery_note";
  businessName: string;
  physicalAddress: string | null;
  primaryPhone: string | null;
  deliveryNoteNumber: string;
  sourceDocumentLabel: string;
  sourceDocumentNumber: string | null;
  dateLabel: string;
  recipientName: string;
  country: string | null;
  town: string | null;
  deliveryAddress: string;
  deliveryNotes: string | null;
  riderName: string | null;
  riderPhone: string | null;
  riderCompany: string | null;
  riderVehicleDescription: string | null;
  isDelivered: boolean;
  deliveredAt: string | null;
};

/** Backs the "Request Return" form's item/quantity picker on a receipt — see SERVER's
 * getSaleReturnableItems (mobile-sales-service.ts) for the full doc comment on why this is a
 * separate raw lookup, not the display-only SharedDocument shape. */
export type MobileReturnableItem = {
  saleItemId: string;
  productId: string;
  productName: string;
  quantitySold: number;
  alreadyReturnedQuantity: number;
  remainingQuantity: number;
  unitPriceCents: number;
};

export type RequestSaleReturnInput = {
  reason: string;
  notes?: string;
  items: Array<{ saleItemId: string; quantity: number }>;
  /** Return now instead of requesting (approvals.approve only — SERVER checks). */
  approveNow?: boolean;
};

/** A void or return waiting in the Approvals tab (SERVER's mobile-sale-adjustments-service.ts). */
export type MobilePendingSaleAdjustment = {
  kind: "void" | "return";
  id: string;
  saleId: string;
  documentNumber: string | null;
  saleGrandTotalCents: number;
  amountCents: number;
  locationName: string;
  reason: string;
  notes: string | null;
  requestedByName: string;
  requestedAt: string;
  lines: string[];
  currency: string;
};

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string | null;
  customerName: string | null;
  employeeName: string;
  locationName: string;
  locationId: string;
  grandTotalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  dueDate: string | null;
  paymentStatus: string;
  createdAt: string;
  currency: string;
};

export type MobileCustomer = { id: string; name: string; phone: string; customerCode: string };

export type MobileCustomerDetail = {
  id: string;
  customerCode: string;
  customerType: "retail" | "wholesale" | "corporate" | "walk_in" | "personal";
  name: string;
  phone: string;
  email: string | null;
  kraPin: string | null;
  physicalAddress: string | null;
  creditLimitCents: number | null;
  notes: string | null;
  status: string;
};

export type MobileSupplierDetail = {
  id: string;
  supplierCode: string;
  businessName: string;
  contactPerson: string | null;
  phone1: string;
  phone2: string | null;
  email: string | null;
  kraPin: string | null;
  town: string | null;
  physicalAddress: string | null;
  paymentOption: "cash" | "mpesa" | "bank_transfer" | "other";
  mpesaName: string | null;
  mpesaNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  creditLimitCents: number | null;
  notes: string | null;
  status: string;
};

/** Customers tab list item — what they currently owe across unpaid invoices (SERVER computes it the
 * same way DESKTOP's own debtor balance does: total − paid − approved returns, voided excluded). */
export type MobileCustomerWithBalance = MobileCustomer & { balanceDueCents: number; unpaidInvoiceCount: number };

export type MobileOutstandingInvoice = {
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  dueDate: string | null;
  grandTotalCents: number;
  amountPaidCents: number;
  outstandingCents: number;
  paymentStatus: string;
};

export type MobileCustomerDebt = {
  customerId: string;
  customerName: string;
  totalDueCents: number;
  invoices: MobileOutstandingInvoice[];
};

export type CollectCustomerPaymentInput = {
  /** Minted client-side, resent unchanged on retry — SERVER never applies the same payment twice. */
  id: string;
  paymentMethodId: string;
  amountCents: number;
  reference: string | null;
  notes: string | null;
};

export type CollectCustomerPaymentResult = {
  allocations: Array<{ saleId: string; invoiceNumber: string; amountCents: number }>;
  remainingDueCents: number;
};

export type CreateCustomerInput = { name: string; phone: string };

export type MobileRider = { id: string; name: string; phone: string; vehicleDescription: string | null };

export type CreateRiderInput = { name: string; phone: string; vehicleDescription?: string };

export type SharedStatementInvoiceLine = {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  grandTotalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  paymentStatus: string;
};

export type QuotationListItem = {
  id: string;
  quotationNumber: string;
  customerName: string | null;
  employeeName: string;
  locationName: string;
  locationId: string;
  grandTotalCents: number;
  /** Null means the quotation never expires — see computeQuotationStatus. */
  validUntil: string | null;
  status: string;
  createdAt: string;
  currency: string;
};

export type TransactionDirection = "in" | "out";
export type TransactionSourceType = "sale" | "sale_return" | "purchase" | "expense" | "salary";
export type TransactionPartyLabel = "Customer" | "Supplier" | "Employee" | "For";

export type TransactionRow = {
  id: string;
  transactionCode: string;
  occurredAt: string;
  locationName: string;
  paymentMethodName: string | null;
  processedByName: string;
  partyName: string | null;
  partyLabel: TransactionPartyLabel;
  sourceType: TransactionSourceType;
  direction: TransactionDirection;
  amountCents: number;
  status: "complete" | "failed";
  currency: string;
};

export type SalesReportMode = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export type SalesReportPeriodInput =
  | { mode: "daily" | "weekly" | "monthly" | "yearly"; anchor: string }
  | { mode: "custom"; startDate: string; endDate: string };

export type SalesReportOverview = {
  mode: SalesReportMode;
  label: string;
  startDate: string;
  endDate: string;
  currency: string;
  totalRevenueCents: number;
  totalRevenueChangePercent: number | null;
  netRevenueCents: number;
  netRevenueChangePercent: number | null;
  totalExpensesCents: number;
  totalExpensesChangePercent: number | null;
  netProfitCents: number;
  netProfitChangePercent: number | null;
  transactionCount: number;
  averageSaleCents: number;
  itemsSold: number;
  spansMultipleDays: boolean;
  averageDailyRevenueCents: number;
  topProducts: SalesTopProduct[];
  productsSold: SalesProductSold[];
  paymentSplit: PaymentMethodBreakdownEntry[];
  /** Purchases (goods + shipping) actually paid to suppliers this period — "Total Capital
   * Invested." Informational only, never folded into totalExpensesCents/netProfitCents. */
  purchasesPaidCents: number;
};

export type SalesTrendPoint = { periodLabel: string; periodStart: string; revenueCents: number; transactionCount: number; isSelected: boolean };
export type SalesTrendResult = { mode: SalesReportMode; points: SalesTrendPoint[] };

export type SalesByStorefrontRow = {
  locationId: string;
  locationName: string;
  revenueCents: number;
  transactionCount: number;
  averageSaleCents: number;
  percentOfTotal: number;
};

export type SalesByEmployeeRow = {
  employeeId: string;
  employeeName: string;
  branchName: string | null;
  revenueCents: number;
  transactionCount: number;
  averageSaleCents: number;
  percentOfTotal: number;
};

export type SalesReportBreakdowns = { byStorefront: SalesByStorefrontRow[]; byEmployee: SalesByEmployeeRow[] };

export type MobileTaxTopProductRow = {
  productId: string;
  productName: string;
  sku: string;
  taxType: TaxType;
  quantitySold: number;
  netCents: number;
  taxCents: number;
  grossCents: number;
};

export type MobileTaxReport = {
  vatRatePercent: number;
  byCategory: TaxBreakdownEntry[];
  totalNetCents: number;
  totalTaxCents: number;
  totalGrossCents: number;
  topTaxedProducts: MobileTaxTopProductRow[];
};

export type ProductListItem = {
  id: string;
  name: string;
  sku: string;
  /** Matched by a scan (camera or hardware scanner) at Checkout — null when the product has none. */
  barcode: string | null;
  categoryName: string | null;
  /** Preview only for the Checkout cart — SERVER always recomputes the real total from the actual
   * Product row at checkout time, never trusts what this list showed. */
  sellingPriceCents: number;
  taxType: string;
  /** This product's own inclusive/exclusive override, or null to fall back to the tenant default
   * (MobileSessionInfo.pricesTaxInclusive) — see resolveProductTaxConfig in lib/tax.ts. */
  pricesTaxInclusive: boolean | null;
  /** The floor a cashier's price override/discount can never push this line below — null means no
   * floor. See CheckoutTab's price-override field. */
  minimumPriceCents: number | null;
  /** Auto-pricing at a quantity threshold — null wholesalePriceCents or a zero/negative
   * wholesaleMinQuantity means this product has no wholesale tier at all. */
  wholesalePriceCents: number | null;
  wholesaleMinQuantity: number;
  reorderLevel: number;
  mainStoreQuantity: number | null;
  storefrontQuantity: number;
  /** Same total as storefrontQuantity, broken out per storefront — every active storefront-type
   * location appears here, even at 0. */
  storefrontBreakdown: { locationId: string; locationName: string; quantity: number }[];
  totalQuantity: number;
  lowStock: boolean;
  outOfStock: boolean;
  /** Variants (see lib/variants.ts) — null/absent when the product has none. */
  variants?: MobileProductVariants | null;
  /** "active" | "inactive" (archived). Only the Products tab's includeAll list ever has inactive ones. */
  status: string;
  /** False for a non-stock item (e.g. a service) — again only in the includeAll list. */
  trackStock: boolean;
};

export type MobileCategory = { id: string; name: string };

export type MobileBusinessProfile = {
  businessName: string;
  contactPhone: string | null;
  alternativePhone: string | null;
  email: string | null;
  website: string | null;
  kraPin: string | null;
  cityTown: string | null;
  physicalAddress: string | null;
  vatRatePercent: number;
  pricesTaxInclusive: boolean;
};

export type MobileStorefrontDetails = {
  id: string;
  locationName: string;
  phone: string | null;
  email: string | null;
  physicalAddress: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
};

export type MobilePaymentMethodAdmin = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  requiresReference: boolean;
  isSystemMethod: boolean;
};

export type MobileSettings = {
  profile: MobileBusinessProfile;
  storefronts: MobileStorefrontDetails[];
  paymentMethods: MobilePaymentMethodAdmin[];
};

export type ProductTaxTypeValue = "vat" | "exempted" | "zero_rated";

/** Body for creating/updating a product — the day-to-day subset of DESKTOP's own Product form.
 * Blank sku on create = SERVER mints one ("PROD-M3-000012"). */
export type ProductInput = {
  name: string;
  sku?: string;
  barcode: string | null;
  categoryId: string | null;
  storefrontId: string | null;
  unitOfMeasure: string | null;
  description: string | null;
  buyingPriceCents: number;
  sellingPriceCents: number;
  wholesalePriceCents: number | null;
  wholesaleMinQuantity: number;
  minimumPriceCents: number | null;
  taxType: ProductTaxTypeValue;
  pricesTaxInclusive: boolean | null;
  reorderLevel: number;
  trackStock: boolean;
  allowNegativeStock: boolean;
};

export type CreateProductInput = ProductInput & { openingStock: { locationId: string; quantity: number } | null };

export type ProductEditData = Omit<ProductInput, "sku" | "taxType"> & {
  id: string;
  sku: string;
  status: string;
  taxType: string;
  hasVariants: boolean;
};

export type StockAdjustmentMode = "add" | "remove" | "count";

export type StockAdjustmentInput = {
  /** Minted client-side, resent unchanged on retry — SERVER treats a repeat as a no-op. */
  id: string;
  productId: string;
  locationId: string;
  mode: StockAdjustmentMode;
  addReason?: "purchase" | "return" | "opening_stock";
  /** add/remove: how many; count: the physical count itself. */
  quantity: number;
  notes: string | null;
};

export type StockAdjustmentResult = { id: string; previousQuantity: number; newQuantity: number };

export type MobileProductVariants = {
  mode: "shared" | "separate";
  /** separate stock: the group every sibling shares */
  groupId: string | null;
  title: string | null;
  options: { name: string; values: string[] }[];
  /** shared stock: the sellable variants (priceCents null = the product's own price) */
  shared: { key: string; values: Record<string, string>; label: string; priceCents: number | null; sku: string | null; barcode: string | null }[];
  /** separate stock: this product's own option values + label */
  values: Record<string, string>;
  label: string | null;
};

/** `code` "MPESA" (DESKTOP's own seeded code) is what Checkout offers an STK prompt for. */
export type PaymentMethodOption = { id: string; name: string; code: string; requiresReference: boolean };

export type StockValueReport = {
  currency: string;
  /** Distinct products with at least one unit on hand. */
  productsInStock: number;
  /** Active, stock-tracked products with nothing on hand. */
  productsOutOfStock: number;
  totalUnits: number;
  costValueCents: number;
  retailValueCents: number;
  locations: Array<{
    locationId: string;
    locationName: string;
    isMainStore: boolean;
    productCount: number;
    totalUnits: number;
    costValueCents: number;
    retailValueCents: number;
    lowStockCount: number;
    outOfStockCount: number;
  }>;
  topProducts: Array<{ productId: string; name: string; sku: string; units: number; costValueCents: number; retailValueCents: number }>;
};

export type ProductPerformanceReport = {
  currency: string;
  startDate: string;
  endDate: string;
  bestSelling: Array<{ productId: string; name: string; sku: string; quantitySold: number; revenueCents: number; costCents: number; profitCents: number }>;
  /** daysSinceLastSale null = no sale within lookbackDays. */
  slowMoving: Array<{ productId: string; name: string; sku: string; quantitySoldInPeriod: number; daysSinceLastSale: number | null }>;
  lookbackDays: number;
};

export type MobileCashUp = {
  date: string;
  locationId: string | null;
  locationName: string | null;
  employeeId: string | null;
  currency: string;
  byMethod: Array<{ paymentMethodId: string; name: string; isCash: boolean; amountCents: number; count: number }>;
  totalCollectedCents: number;
  salesCount: number;
  voidedCount: number;
  refundsCents: number;
  cashExpensesCents: number;
  expectedCashCents: number;
  byCashier: Array<{ employeeId: string; name: string; amountCents: number; salesCount: number }> | null;
};

export type MpesaStatusResult = { status: string; message: string; mpesaReceiptNumber: string | null; amountCents: number; phone: string };

/** One line in the Checkout cart — a client-side PREVIEW only. quantity/discountAmountCents are the
 * only fields that actually reach SERVER (see CheckoutRequest below); unitPriceCents/lineTotalCents
 * here exist purely to show the cashier a running total before they submit. */
export type CheckoutCartLine = {
  /** Line identity — the product id, or product id + variant key (lib/variants.ts cartLineId), so
   * the same product in two colours is two lines. Every per-line handler matches on this. */
  lineId: string;
  productId: string;
  /** shared-stock variant on this line — sent with the document; SERVER prices it */
  variantKey: string | null;
  /** a DESKTOP invoice/quotation section, carried through untouched when editing on the phone */
  sectionLabel: string | null;
  name: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  discountAmountCents: number;
  /** Captured from the product at add-to-cart time — needed to compute this line's real
   * tax-inclusive total (see lib/tax.ts's computeLineTax), same fields SERVER uses authoritatively. */
  taxType: string;
  pricesTaxInclusive: boolean | null;
  /** The floor this line's effective price (natural or overridden) can never drop below — copied
   * from the product at add-to-cart time. */
  minimumPriceCents: number | null;
  /** Auto-pricing at a quantity threshold, copied from the product at add-to-cart time — see
   * naturalUnitPriceCents in lib/cart-totals.ts for how this combines with quantity. */
  wholesalePriceCents: number | null;
  wholesaleMinQuantity: number;
  /** Cashier-entered mark-up/override for this line only, raw text like discountAmountCents' own UI
   * field — empty means "use the product's own listed price," same convention as DESKTOP's own
   * priceOverride. Never written back to the product. */
  priceOverride: string;
  /** This line's product was bought from another shop on the spot rather than pulled from this
   * shop's own stock — skips the usual stock deduction (see mobile-checkout-service.ts). localCost
   * is raw text like priceOverride; localSupplierId is null until a supplier is picked/created. */
  isLocallySourced: boolean;
  localCost: string;
  localSupplierId: string | null;
  /** Invoices only: where THIS line's stock comes from (chosen per line when the admin's "Invoice
   * stock from Main Store" toggle is on). Undefined = storefront. */
  stockSource?: InvoiceStockSource;
};

/** Mirrors DESKTOP's own ExtraChargesSection DeliveryDraft — see SERVER's
 * mobileCheckoutDeliverySchema for the authoritative field list. feeCents/costCents are already
 * converted to cents by the time this is built (see CheckoutTab's DeliveryModal). */
export type CheckoutDeliveryInput = {
  riderId?: string;
  recipientName: string;
  country: string;
  town: string;
  physicalAddress: string;
  notes: string;
  feeCents: number;
  costCents: number;
};

export type CheckoutItemInput = {
  productId: string;
  quantity: number;
  discountAmountCents: number;
  unitPriceCents?: number;
  isLocallySourced?: boolean;
  localCostCents?: number;
  localSupplierId?: string;
};

/** Named ad-hoc fee (e.g. "Labour", "Installation") — unlimited per document, folds into
 * grandTotalCents alongside delivery. costCents is internal-only, never shown to the customer. */
export type ServiceChargeInput = { name: string; feeCents: number; costCents: number };

/** Client-side draft for one service-charge row being edited — raw text like priceOverride, same
 * convention as CheckoutDeliveryModal's fee/cost fields. */
export type ServiceChargeDraft = { name: string; fee: string; cost: string };

export type CheckoutRequest = {
  id: string;
  locationId: string;
  items: CheckoutItemInput[];
  paymentMethodId: string;
  paymentReference?: string;
  customerId?: string;
  amountReceivedCents: number;
  /** Split payment — only when paying with 2+ methods (SERVER's buildSplitPayments rules apply). */
  payments?: Array<{ paymentMethodId: string; amountCents: number; reference?: string }>;
  delivery?: CheckoutDeliveryInput;
  serviceCharges?: ServiceChargeInput[];
  notes?: string;
  includeTaxBreakdown?: boolean;
  includeBusinessInfo?: boolean;
  /** Completed while offline and only being sent now (see lib/sales-outbox.ts). */
  queuedOffline?: boolean;
  /** When the sale actually happened on the phone (ISO). */
  offlineCompletedAt?: string;
};

export type MobileSupplier = { id: string; businessName: string; phone1: string };

/** Suppliers tab list item. balanceCents is signed: positive = we owe them. */
export type MobileSupplierWithBalance = MobileSupplier & { supplierCode: string; balanceCents: number };

export type MobileSupplierBalanceEntry = {
  id: string;
  entryType: string;
  /** Signed: positive grew what we owe, negative reduced it. */
  amountCents: number;
  notes: string | null;
  /** The purchase number when the entry came from a purchase. */
  reference: string | null;
  performedByName: string | null;
  createdAt: string;
};

export type CreateSupplierInput = { businessName: string; contactPerson?: string; phone1: string };

/** stockShortfalls: products a sale queued offline took below zero (SERVER accepts it anyway — the
 * goods already left); always empty for a normal online sale. */
export type CheckoutResult = { id: string; receiptNumber: string; grandTotalCents: number; stockShortfalls?: string[] };

// --- Invoices & Quotations (Phase 2) ---

export type DocumentIdResult = { id: string };

/** Where an invoice's stock is deducted from — "main_store" only when invoiceStockFromMainStore. */
export type InvoiceStockSource = "storefront" | "main_store";

export type CreateInvoiceRequest = {
  /** Optional client-minted id, resent unchanged on retry so the same invoice can't be created twice. */
  id?: string;
  customerId: string;
  transactionType: "invoice" | "wholesale_sale";
  dueDate: string;
  invoiceNotes?: string;
  includeTaxBreakdown?: boolean;
  includeBusinessInfo?: boolean;
  /** stockSource per line: omitted = storefront on create, the line's current source on edit. */
  items: Array<CheckoutItemInput & { stockSource?: InvoiceStockSource }>;
  initialPayment?: { paymentMethodId: string; amountCents: number; reference?: string } | null;
  delivery?: CheckoutDeliveryInput;
  serviceCharges?: ServiceChargeInput[];
  locationId: string;
};

export type RecordPaymentRequest = { paymentMethodId: string; amountCents: number; reference?: string; notes?: string };

export type MarkPaidRequest = { paymentMethodId: string; reference?: string; notes?: string };

export type CreateQuotationRequest = {
  customerId?: string;
  /** Omit or null for a quotation that never expires (client set no expiry date). */
  validUntil?: string | null;
  notes?: string;
  includeTaxBreakdown?: boolean;
  includeBusinessInfo?: boolean;
  items: CheckoutItemInput[];
  delivery?: CheckoutDeliveryInput;
  serviceCharges?: ServiceChargeInput[];
  locationId: string;
};

export type QuotationStatusValue = "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export type QuotationStockCheckItem = {
  productId: string;
  productName: string;
  requestedQuantity: number;
  availableQuantity: number;
  sufficient: boolean;
  /** What the Main Store could supply this storefront (earmark + unallocated); null unless the
   * admin's "Invoice stock from Main Store" toggle is on. */
  mainStoreAvailableQuantity: number | null;
};

export type QuantityOverride = { productId: string; quantity: number };

export type ConvertToSaleRequest = {
  paymentMethodId: string;
  paymentReference?: string;
  amountReceivedCents?: number | null;
  quantityOverrides?: QuantityOverride[];
};

export type ConvertToInvoiceRequest = {
  dueDate: string;
  quantityOverrides?: QuantityOverride[];
  /** Per-line stock source, keyed by productId; a line not listed takes the storefront. */
  stockSources?: Array<{ productId: string; stockSource: InvoiceStockSource }>;
  /** Who to bill when the quotation was for a walk-in — ignored when it already has a customer. */
  customerId?: string;
};

/** Raw, re-editable line item shape — deliberately NOT SharedLineItem (that's a display-only shape
 * with no productId/taxType/isLocallySourced). Returned by GET /mobile/invoices/:id/edit and
 * GET /mobile/quotations/:id/edit, same shape items[] already sends on create/update. */
export type MobileEditableItem = {
  productId: string;
  variantKey?: string | null;
  variantLabel?: string | null;
  sectionLabel?: string | null;
  quantity: number;
  unitPriceCents: number;
  discountAmountCents: number;
  isLocallySourced: boolean;
  localCostCents: number | null;
  localSupplierId: string | null;
  /** Invoices only — this line's current stock source. */
  stockSource?: InvoiceStockSource;
};

export type MobileEditableDelivery = {
  riderId: string | null;
  recipientName: string;
  country: string;
  town: string;
  physicalAddress: string;
  notes: string;
  feeCents: number;
  costCents: number;
};

export type MobileInvoiceEditData = {
  customerId: string;
  transactionType: "invoice" | "wholesale_sale";
  dueDate: string;
  invoiceNotes: string | null;
  includeTaxBreakdown: boolean;
  includeBusinessInfo: boolean;
  items: MobileEditableItem[];
  delivery: MobileEditableDelivery | null;
  serviceCharges: ServiceChargeInput[];
};

export type MobileQuotationEditData = {
  customerId: string | null;
  /** Null means the quotation never expires (client set no expiry date). */
  validUntil: string | null;
  notes: string | null;
  includeTaxBreakdown: boolean;
  includeBusinessInfo: boolean;
  items: MobileEditableItem[];
  delivery: MobileEditableDelivery | null;
  serviceCharges: ServiceChargeInput[];
};

export type PurchaseListItem = {
  id: string;
  purchaseNumber: string;
  supplierName: string;
  locationName: string;
  locationId: string;
  status: string;
  paymentStatus: string;
  grandTotalCents: number;
  amountPaidCents: number;
  orderedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  currency: string;
};

export type PurchaseItemLine = {
  /** purchase_items id — what Receive Goods sends back per line. */
  id: string;
  productId: string;
  productName: string;
  /** Needed to re-open a draft for editing. */
  taxType: string;
  sellingPriceCents: number | null;
  sku: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCostCents: number;
  discountAmountCents: number;
  taxAmountCents: number;
  lineTotalCents: number;
};


export type PurchasePaymentLine = {
  paymentMethodName: string;
  amountCents: number;
  reference: string | null;
  paidByName: string;
  paidAt: string;
};

export type PurchaseDetail = {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  locationId: string;
  /** "Shipping Fee" — owed to the supplier once anything is received. */
  shippingCostCents: number;
  /** "Shipping Cost" — the business's own expense, never owed. */
  shippingExpenseCents: number;
  /** Item value received so far — payments are made against this. */
  receivedValueCents: number;
  /** What can be paid right now (received value + shipping fee once anything arrived − paid). */
  balanceDueCents: number;
  supplierName: string;
  supplierPhone: string | null;
  locationName: string;
  supplierInvoiceNumber: string | null;
  status: string;
  taxType: string;
  paymentStatus: string;
  orderedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  items: PurchaseItemLine[];
  subtotalCents: number;
  discountAmountCents: number;
  taxAmountCents: number;
  taxBreakdown: TaxBreakdownEntry[];
  vatRatePercent: number;
  grandTotalCents: number;
  amountPaidCents: number;
  payments: PurchasePaymentLine[];
  currency: string;
};

export type CreatePurchaseLine = {
  productId: string;
  orderedQuantity: number;
  unitCostCents: number;
  /** Optional new selling price — set on the product when the order is placed. */
  sellingPriceCents: number | null;
  taxType: string;
};

export type CreatePurchaseInput = {
  /** Minted client-side, resent unchanged on retry — SERVER treats a repeat as a no-op. */
  id: string;
  supplierId: string;
  supplierInvoiceNumber: string | null;
  locationId: string;
  shippingCostCents: number;
  shippingExpenseCents: number;
  notes: string | null;
  items: CreatePurchaseLine[];
  intent: "draft" | "ordered";
};

export type PurchasePaymentInput = {
  paymentMethodId: string;
  /** Omitted = pay off the full balance currently due. */
  amountCents?: number;
  reference: string | null;
  notes: string | null;
};

export type ExpenseListItem = {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  categoryName: string;
  amountCents: number;
  paymentMethodName: string | null;
  locationName: string;
  reference: string | null;
  description: string | null;
  status: string;
  currency: string;
  /** Raw ids — pre-fill the Edit Expense sheet. */
  categoryId: string;
  paymentMethodId: string;
  storefrontId: string | null;
  paidBy: string | null;
  /** Set for an expense another action created (a purchase's shipping cost, a delivery cost). */
  sourceType: string | null;
};

export type MobileExpenseCategory = { id: string; name: string };

/** Mirrors SERVER's mobileExpenseInputSchema — expenseDate is a plain YYYY-MM-DD string. */
export type ExpenseInput = {
  expenseDate: string;
  categoryId: string;
  amountCents: number;
  paymentMethodId: string;
  storefrontId: string;
  reference: string | null;
  description: string | null;
};

export type StockMovementType = "purchase" | "sale" | "transfer_in" | "transfer_out" | "return" | "damage" | "adjustment" | "opening_stock";

export type StockMovementRow = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  locationId: string;
  locationName: string;
  movementType: StockMovementType;
  quantityChange: number;
  /** That location's stock right after this movement — null on older rows. */
  balanceAfter: number | null;
  valueCents: number;
  notes: string | null;
  createdAt: string;
  currency: string;
};

/** Approvals tab "Recent Decisions" — one approved/rejected void, return or invoice cancellation. */
export type RecentApprovalDecision = {
  kind: "void" | "return" | "invoice_cancellation";
  id: string;
  saleId: string;
  documentNumber: string | null;
  locationName: string | null;
  reason: string;
  status: "approved" | "rejected";
  decidedByName: string | null;
  decidedAt: string | null;
};

/** Backs the Approvals tab — one invoice-cancellation request still awaiting a decision. */
export type InvoiceCancellationApprovalItem = {
  id: string;
  saleId: string;
  invoiceNumber: string | null;
  saleGrandTotalCents: number;
  locationName: string;
  reason: string;
  notes: string | null;
  requestedByName: string;
  requestedAt: string;
  currency: string;
};

/** Mirrors SERVER's SharedStatementResult exactly — same reuse convention as SharedDocument above. */
export type SharedStatement = {
  documentKind: "statement";
  businessName: string;
  physicalAddress: string | null;
  primaryPhone: string | null;
  currency: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  creditLimitCents: number | null;
  generatedAt: string;
  invoices: SharedStatementInvoiceLine[];
  totalInvoicedCents: number;
  totalPaidCents: number;
  totalOutstandingCents: number;
};

// --- Working Hours lockout (Super Admin only) ---

export type WorkingHoursLockMode = "auto" | "manual";

export type WorkingHoursScheduleDay = { isOpen: boolean; openTime: string | null; closeTime: string | null };

/** Keyed "0".."6" — 0=Sunday..6=Saturday, matches JS Date.getDay(). */
export type WorkingHoursSchedule = Record<string, WorkingHoursScheduleDay>;

export type WorkingHoursConfig = {
  locationId: string;
  locationName: string;
  lockEnabled: boolean;
  lockMode: WorkingHoursLockMode;
  manuallyLocked: boolean;
  timezoneOffsetMinutes: number;
  schedule: WorkingHoursSchedule;
};

/** One row per storefront for the Working Hours tab's picker — `config: null` means that
 * storefront has never been configured (always-open by default). */
export type WorkingHoursListItem = { locationId: string; locationName: string; config: WorkingHoursConfig | null };

export type WorkingHoursUpsertInput = {
  lockEnabled: boolean;
  lockMode: WorkingHoursLockMode;
  manuallyLocked: boolean;
  timezoneOffsetMinutes: number;
  schedule: WorkingHoursSchedule;
};
