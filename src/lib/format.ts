// Number, percent and date formatting for the admin and the boards. Pure:
// no Prisma, safe on the client and the server.
//
// Dates always take the organization's time zone (architecture.md →
// Invariant 11). Strings are built from numeric parts with our own month
// and weekday names, never from ICU's text: Node and browsers disagree on
// "Sep" vs "Sept" and on the narrow no-break space before AM/PM, and the
// server PNG and the browser preview must print the same text.

import { toDecimalString } from "@/lib/decimal";

// ── Numbers (rates arrive as decimal strings, e.g. "1365.0000") ──

// Integer digits and fraction digits without trailing zeros.
function splitDecimal(value: string) {
  const text = toDecimalString(value);
  const negative = text.startsWith("-");
  const [int = "0", frac = ""] = text.replace("-", "").split(".");
  return {
    sign: negative ? "-" : "",
    int: int.replace(/^0+(?=\d)/, ""),
    frac: frac.replace(/0+$/, ""),
  };
}

function groupThousands(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Admin tables: "1365.0000" → "1,365"; "1365.5000" → "1,365.5".
export function formatRate(value: string): string {
  const { sign, int, frac } = splitDecimal(value);
  return sign + groupThousands(int) + (frac ? `.${frac}` : "");
}

// Board prices, printed without a separator: "1365.0000" → "1365".
export function formatBoardPrice(value: string): string {
  const { sign, int, frac } = splitDecimal(value);
  return sign + int + (frac ? `.${frac}` : "");
}

// POF rates: "3.40" → "3.4%"; "3.00" → "3%"; "2.25" → "2.25%".
export function formatPercent(value: string): string {
  return `${formatBoardPrice(value)}%`;
}

// Change in POF rate, in percentage points: "0.1" → "0.1 pts".
export function formatPoints(value: string): string {
  return `${formatBoardPrice(value)} pts`;
}

// ── Dates (always in the organization's time zone) ──

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
] as const;
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type ZonedParts = {
  year: number;
  month: number; // 1–12
  day: number;
  weekday: number; // 0 = Sunday
  hour: number; // 0–23
  minute: number;
};

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(date: Date, timeZone: string): ZonedParts {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    partsFormatters.set(timeZone, formatter);
  }
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  const year = values.year ?? 0;
  const month = values.month ?? 1;
  const day = values.day ?? 1;
  return {
    year,
    month,
    day,
    // The weekday of a calendar date doesn't depend on the zone.
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
  };
}

// Boards: "Sun, 27 Sept 2026".
export function formatBoardDate(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${WEEKDAYS_SHORT[p.weekday]}, ${p.day} ${MONTHS_SHORT[p.month - 1]} ${p.year}`;
}

// Boards and lists: "10:25 AM" (a normal space before AM/PM).
export function formatBoardTime(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const minute = String(p.minute).padStart(2, "0");
  return `${hour12}:${minute} ${p.hour < 12 ? "AM" : "PM"}`;
}

// Full date: "Saturday, 26 September 2026".
export function formatLongDate(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${WEEKDAYS_LONG[p.weekday]}, ${p.day} ${MONTHS_LONG[p.month - 1]} ${p.year}`;
}

// True when both instants fall on the same calendar day in the org's zone.
export function isSameOrgDay(a: Date, b: Date, timeZone: string): boolean {
  const pa = zonedParts(a, timeZone);
  const pb = zonedParts(b, timeZone);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

// History day headings: "Today", otherwise the full date. `now` is passed
// in so callers (and tests) control the clock.
export function formatDayHeading(
  date: Date,
  now: Date,
  timeZone: string,
): string {
  return isSameOrgDay(date, now, timeZone)
    ? "Today"
    : formatLongDate(date, timeZone);
}

// Board detail subtitles: "Today", otherwise "Fri 25 Sept" (with the year
// when it isn't this year in the org zone). Callers add " at <time>".
export function formatBoardDay(
  date: Date,
  now: Date,
  timeZone: string,
): string {
  if (isSameOrgDay(date, now, timeZone)) return "Today";
  const p = zonedParts(date, timeZone);
  const year = zonedParts(now, timeZone).year === p.year ? "" : ` ${p.year}`;
  return `${WEEKDAYS_SHORT[p.weekday]} ${p.day} ${MONTHS_SHORT[p.month - 1]}${year}`;
}

// Short date: "22 Sept", with the year when it isn't the current year in
// the org zone ("22 Sept 2025"), so an old rate never reads as recent.
function formatShortDate(date: Date, now: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const year = zonedParts(now, timeZone).year === p.year ? "" : ` ${p.year}`;
  return `${p.day} ${MONTHS_SHORT[p.month - 1]}${year}`;
}

// Tables' "Updated" column: "Today, 10:25 AM" for today in the org zone,
// otherwise the short date ("22 Sept").
export function formatUpdatedAt(
  date: Date,
  now: Date,
  timeZone: string,
): string {
  return isSameOrgDay(date, now, timeZone)
    ? `Today, ${formatBoardTime(date, timeZone)}`
    : formatShortDate(date, now, timeZone);
}

// Rate history lists: "27 Sept, 10:25 AM" (year added as above).
export function formatShortDateTime(
  date: Date,
  now: Date,
  timeZone: string,
): string {
  return `${formatShortDate(date, now, timeZone)}, ${formatBoardTime(date, timeZone)}`;
}
