import { API_URL, ApiError, LICENSE_KEY_STORAGE_KEY, OFFLINE_ERROR_CODE } from "./api";

/**
 * Paying Blue Ledger for this business's own subscription — the same license-key-authenticated
 * SERVER routes DESKTOP's Payments page and lockout screen use (/activation/*, /billing-mpesa/*,
 * /billing-pesapal/*). No session needed, so the login screen can use them too: a business locked
 * for non-payment can still pay from here. The license key is the one this phone signed in with.
 */

export type BillingPeriodEntry = { key: string; label: string; status: "paid" | "overdue" | "due" | "future" };

export type PaymentSchedule = {
  billingCycle: "MONTHLY" | "YEARLY" | "ONCE";
  pricePerPeriodCents: number | null;
  currency: string;
  periods: BillingPeriodEntry[];
  nextDueDate: string | null;
  walletBalanceCents?: number;
};

export type WalletEntry = {
  id: string;
  kind: string;
  amountCents: number;
  balanceAfterCents: number;
  billingPeriod: string | null;
  paymentMethod: string | null;
  reference: string | null;
  note: string | null;
  createdAt: string;
};

export type Wallet = {
  balanceCents: number;
  currency: string;
  pricePerPeriodCents: number | null;
  billingCycle: string;
  periodsCovered: number;
  nextDueDate: string | null;
  nextDueUncovered: boolean;
  entries: WalletEntry[];
};

export type BillingPayment = {
  id: string;
  amountCents: number;
  currency: string;
  paymentMethod: string;
  billingPeriod: string;
  paymentDate: string;
};

export type StkPushResult = { checkoutRequestId: string; amountCents: number };
export type StkStatus = { status: string; message: string; mpesaReceiptNumber: string | null; amountCents: number };
export type CardOrder = { orderTrackingId: string; redirectUrl: string; amountCents: number };
export type CardStatus = { status: string; message: string; confirmationCode: string | null; amountCents: number };

/** Same floor as SERVER's lib/subscription-wallet.ts MIN_TOPUP_KES. */
export const MIN_TOPUP_KES = 50;

export function storedLicenseKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LICENSE_KEY_STORAGE_KEY);
}

async function post<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const licenseKey = storedLicenseKey();
  if (!API_URL) throw new ApiError(0, "NEXT_PUBLIC_API_URL is not configured");
  if (!licenseKey) throw new ApiError(0, "Sign in once on this phone first.");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, licenseKey }),
    });
  } catch {
    throw new ApiError(0, "You're offline — check your internet connection.", OFFLINE_ERROR_CODE);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const billing = {
  schedule: () => post<PaymentSchedule>("/activation/payment-schedule"),
  wallet: () => post<Wallet>("/activation/wallet"),
  payments: () => post<{ recentPayments: BillingPayment[] }>("/activation/payments"),
  payByMpesa: (phone: string, periodCount: number) => post<StkPushResult>("/billing-mpesa/stk-push", { phone, periodCount }),
  topUpByMpesa: (phone: string, amountKes: number) => post<StkPushResult>("/billing-mpesa/topup", { phone, amountKes }),
  /** Passive — what the callback already recorded. Polled while waiting for the PIN. */
  mpesaStatus: (checkoutRequestId: string) => post<StkStatus>("/billing-mpesa/status", { checkoutRequestId }),
  /** Asks Safaricom — only on an explicit "Check now". */
  mpesaCheck: (checkoutRequestId: string) => post<StkStatus>("/billing-mpesa/status/check", { checkoutRequestId }),
  payByCard: (periodCount: number) => post<CardOrder>("/billing-pesapal/submit-order", { periodCount, enrollAutoBilling: false }),
  topUpByCard: (amountKes: number) => post<CardOrder>("/billing-pesapal/topup", { amountKes }),
  cardStatus: (orderTrackingId: string) => post<CardStatus>("/billing-pesapal/status", { orderTrackingId }),
  cardCheck: (orderTrackingId: string) => post<CardStatus>("/billing-pesapal/status/check", { orderTrackingId }),
};

/** Periods still owed (overdue first, then the one due now), oldest first. */
export function owedPeriods(schedule: PaymentSchedule | null): BillingPeriodEntry[] {
  return schedule?.periods.filter((entry) => entry.status === "overdue" || entry.status === "due") ?? [];
}
