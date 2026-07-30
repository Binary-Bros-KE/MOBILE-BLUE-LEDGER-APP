/** Ported from DESKTOP's own reports/salesReportDate.ts — same grain-based period model (Daily/
 * Weekly/Monthly/Yearly are fixed calendar periods stepped via `anchor`, Custom is a plain date
 * range). The anchor itself is a calendar label; SERVER resolves it to a real instant range using
 * this device's own timezoneOffsetMinutes() (mobile-sales-report-service.ts) — never the tenant's
 * stored business-record timezone, and never the server's own host timezone. */

export type SalesReportMode = "daily" | "weekly" | "monthly" | "yearly" | "custom";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** This device's real local calendar date, right now — deliberately NOT toIsoDate(new Date()),
 * which reads UTC date parts off a real "now" moment and is wrong by a day for part of the day in
 * any timezone ahead of UTC (e.g. at 1am in Nairobi, UTC is still on yesterday's date). Every OTHER
 * date in this module is an abstract calendar-date string being stepped/compared via UTC arithmetic
 * purely as a DST-safe technique — that's fine and unrelated to this. */
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Sent with every request that resolves a period on SERVER — same convention as JS's own
 * Date.prototype.getTimezoneOffset() (e.g. Nairobi/UTC+3 returns -180). */
export function timezoneOffsetMinutes(): number {
  return new Date().getTimezoneOffset();
}

function addDaysIso(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function mondayOf(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return toIsoDate(date);
}

/** Anchor formats: daily/weekly = `YYYY-MM-DD` (weekly's anchor is that week's Monday); monthly =
 * `YYYY-MM`; yearly = `YYYY`. */
export function defaultAnchorForMode(mode: Exclude<SalesReportMode, "custom">): string {
  const today = todayIso();
  if (mode === "daily") return today;
  if (mode === "weekly") return mondayOf(today);
  if (mode === "monthly") return today.slice(0, 7);
  return today.slice(0, 4);
}

export function maxAnchorForMode(mode: Exclude<SalesReportMode, "custom">): string {
  return defaultAnchorForMode(mode);
}

export function shiftAnchor(mode: Exclude<SalesReportMode, "custom">, anchor: string, steps: number): string {
  if (mode === "daily") return addDaysIso(anchor, steps);
  if (mode === "weekly") return addDaysIso(anchor, steps * 7);
  if (mode === "monthly") {
    const [year, month] = anchor.split("-").map(Number);
    const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1 + steps, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return String(Number(anchor) + steps);
}

export function periodLabelForAnchor(mode: Exclude<SalesReportMode, "custom">, anchor: string): string {
  if (mode === "daily") {
    return new Date(`${anchor}T00:00:00.000Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  if (mode === "weekly") {
    const start = new Date(`${anchor}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  }
  if (mode === "monthly") {
    return new Date(`${anchor}-01T00:00:00.000Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  }
  return anchor;
}

/** `<input type="week">` uses ISO-8601 week numbering (`YYYY-Www`); our anchor is that week's
 * Monday. These two convert between the two representations. */
export function mondayFromIsoWeek(value: string): string | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return toIsoDate(monday);
}

export function isoWeekFromMonday(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstThursdayDay = firstThursday.getUTCDay() || 7;
  const firstMonday = new Date(firstThursday);
  firstMonday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDay + 1);
  const week = Math.round((date.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}
