/** Ported from DESKTOP's own reports/salesReportDate.ts — same grain-based period model (Daily/
 * Weekly/Monthly/Yearly are fixed calendar periods stepped via `anchor`, Custom is a plain date
 * range). All pure date-string math, no timezone awareness needed here — the anchor is just a
 * calendar label; SERVER resolves it to a real tenant-timezone instant range
 * (mobile-sales-report-service.ts). */

export type SalesReportMode = "daily" | "weekly" | "monthly" | "yearly" | "custom";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return toIsoDate(new Date());
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
