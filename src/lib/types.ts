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
};

export type MobileSessionInfo = {
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
  /** Tenant-wide tax defaults — Checkout needs these alongside each product's own pricesTaxInclusive
   * override (see ProductListItem) to compute the real tax-inclusive total, matching what SERVER
   * enforces authoritatively at submit time. */
  vatRatePercent: number;
  pricesTaxInclusive: boolean;
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
  roleName: string | null;
  branchName: string | null;
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

export type MobileLocation = { id: string; locationName: string };

export type SaleListItem = {
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

export type SharedDocument = {
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
  vatRatePercent: number;
  grandTotalCents: number;
  paymentMethodName: string | null;
  paymentReference: string | null;
  amountReceivedCents: number | null;
  changeGivenCents: number | null;
  payments: SharedPayment[];
  transactionType: string | null;
  notes: string | null;
  dueDate: string | null;
  balanceDueCents: number | null;
  paymentStatus: string | null;
  validUntil: string | null;
  quotationStatus: string | null;
};

export type ShareDocumentEntity = "sale" | "quotation" | "customer_statement";

export type ShareLinkResult = { url: string; message: string };

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

export type MobileCustomer = { id: string; name: string; phone: string };

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
  validUntil: string;
  status: string;
  createdAt: string;
  currency: string;
};

export type TransactionDirection = "in" | "out";
export type TransactionSourceType = "sale" | "purchase" | "expense" | "salary";
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
  categoryName: string | null;
  /** Preview only for the Checkout cart — SERVER always recomputes the real total from the actual
   * Product row at checkout time, never trusts what this list showed. */
  sellingPriceCents: number;
  taxType: string;
  /** This product's own inclusive/exclusive override, or null to fall back to the tenant default
   * (MobileSessionInfo.pricesTaxInclusive) — see resolveProductTaxConfig in lib/tax.ts. */
  pricesTaxInclusive: boolean | null;
  reorderLevel: number;
  mainStoreQuantity: number | null;
  storefrontQuantity: number;
  totalQuantity: number;
  lowStock: boolean;
  outOfStock: boolean;
};

export type PaymentMethodOption = { id: string; name: string; requiresReference: boolean };

/** One line in the Checkout cart — a client-side PREVIEW only. quantity/discountAmountCents are the
 * only fields that actually reach SERVER (see CheckoutRequest below); unitPriceCents/lineTotalCents
 * here exist purely to show the cashier a running total before they submit. */
export type CheckoutCartLine = {
  productId: string;
  name: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  discountAmountCents: number;
  /** Captured from the product at add-to-cart time — needed to compute this line's real
   * tax-inclusive total (see lib/tax.ts's computeLineTax), same fields SERVER uses authoritatively. */
  taxType: string;
  pricesTaxInclusive: boolean | null;
};

export type CheckoutRequest = {
  id: string;
  locationId: string;
  items: Array<{ productId: string; quantity: number; discountAmountCents: number }>;
  paymentMethodId: string;
  paymentReference?: string;
  customerId?: string;
  amountReceivedCents: number;
};

export type CheckoutResult = { id: string; receiptNumber: string; grandTotalCents: number };

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
  productName: string;
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
  valueCents: number;
  notes: string | null;
  createdAt: string;
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
