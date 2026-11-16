/**
 * The same two warnings DESKTOP shows (its shared/lib/grace-period.ts and shared/lib/balance-reminder.ts,
 * copied — keep in sync by hand): a payment overdue (30-day grace, then a MONTHLY business is locked),
 * and a prepaid balance that won't cover the next payment.
 */

export const GRACE_PERIOD_DAYS = 30;
export const BALANCE_REMINDER_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type BillingStatus = {
  licenseStatus: string;
  subscriptionType: string | null;
  nextDueDate: string | null;
  walletBalanceCents: number | null;
  pricePerPeriodCents: number | null;
};

export type GraceStatus =
  | { state: "current" }
  | { state: "grace"; daysRemaining: number; hardLock: boolean }
  | { state: "expired"; hardLock: boolean };

export function computeGraceStatus(billing: BillingStatus | null | undefined, now: Date = new Date()): GraceStatus {
  if (!billing || billing.licenseStatus === "trial" || !billing.nextDueDate) return { state: "current" };
  const msPastDue = now.getTime() - new Date(billing.nextDueDate).getTime();
  if (msPastDue <= 0) return { state: "current" };
  const hardLock = billing.subscriptionType === "monthly";
  const daysRemaining = GRACE_PERIOD_DAYS - Math.floor(msPastDue / MS_PER_DAY);
  return daysRemaining > 0 ? { state: "grace", daysRemaining, hardLock } : { state: "expired", hardLock };
}

export type BalanceReminder = { dueDate: string; daysUntilDue: number; balanceCents: number; priceCents: number; shortByCents: number };

/** Only for a business that has topped up (balance above zero) — see DESKTOP's balance-reminder.ts. */
export function computeBalanceReminder(billing: BillingStatus | null | undefined, now: Date = new Date()): BalanceReminder | null {
  if (!billing || billing.licenseStatus === "trial" || !billing.nextDueDate) return null;
  const balance = billing.walletBalanceCents;
  const price = billing.pricePerPeriodCents;
  if (balance === null || balance <= 0 || !price || price <= 0 || balance >= price) return null;
  const msUntilDue = new Date(billing.nextDueDate).getTime() - now.getTime();
  if (msUntilDue <= 0) return null;
  const daysUntilDue = Math.ceil(msUntilDue / MS_PER_DAY);
  if (daysUntilDue > BALANCE_REMINDER_DAYS) return null;
  return { dueDate: billing.nextDueDate, daysUntilDue, balanceCents: balance, priceCents: price, shortByCents: price - balance };
}
