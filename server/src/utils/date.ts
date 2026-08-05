export const BUSINESS_TIMEZONE = "Asia/Kolkata";

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseDateKey(key: string): { y: number; m: number; d: number } {
  const parts = key.split("-").map(Number);
  return { y: parts[0], m: parts[1], d: parts[2] };
}

function utcDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Wall-clock date (YYYY-MM-DD) of a timestamp as seen in the shop timezone (IST).
// Timezone-independent: does not rely on the host process TZ.
export function istDateKey(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return utcDateKey(new Date(d.getTime() + IST_OFFSET_MS));
}

// Shift a YYYY-MM-DD date key by a number of days (can be negative).
export function shiftDateKey(key: string, days: number): string {
  const { y, m, d } = parseDateKey(key);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return utcDateKey(dt);
}

// The instant at 00:00:00.000 IST for a given YYYY-MM-DD business date.
export function istStartOfDay(dateStr: string): Date {
  const { y, m, d } = parseDateKey(dateStr);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

// The instant at 23:59:59.999 IST for a given YYYY-MM-DD business date.
export function istEndOfDay(dateStr: string): Date {
  const { y, m, d } = parseDateKey(dateStr);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - IST_OFFSET_MS);
}

export function istStartOfToday(): Date {
  return istStartOfDay(istDateKey(new Date()));
}

export function istEndOfToday(): Date {
  return istEndOfDay(istDateKey(new Date()));
}

export function istStartOfMonth(key: string): Date {
  const { y, m } = parseDateKey(key);
  return istStartOfDay(`${y}-${pad(m)}-01`);
}

export function istEndOfMonth(key: string): Date {
  const { y, m } = parseDateKey(key);
  const nextMonth = new Date(Date.UTC(y, m, 1));
  return istEndOfDay(utcDateKey(new Date(nextMonth.getTime() - 86400000)));
}

// ISO date part (YYYY-MM-DD) in IST for use in file names / PDF headers.
export function istDatePart(date: Date = new Date()): string {
  return istDateKey(date);
}

export function istDayOfWeek(date: Date = new Date()): number {
  return new Date(date.getTime() + IST_OFFSET_MS).getUTCDay();
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Deterministic IST formatting for PDFs / messages (independent of host TZ).
export function formatISTDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return `${pad(ist.getUTCDate())} ${MONTH_NAMES[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}

export function formatISTDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return `${WEEKDAYS[ist.getUTCDay()]}, ${pad(ist.getUTCDate())} ${MONTH_NAMES[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}
