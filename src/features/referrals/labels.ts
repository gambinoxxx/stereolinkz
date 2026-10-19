// Display strings for the referral programme (Phase 13c), shared by the
// admin pages.
import type { RewardDisplayStatus } from "@/features/referrals/rules";

const MONTHS = [
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
];

// A day as "2026-10-19" in the given time zone (inputs of type date).
export function isoDayIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// "2026-12-18" → "18 Dec 2026".
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

// "Active until 18 Dec 2026", "Starts 1 Nov 2026", "Ended 18 Dec 2026", "Off".
export function programmeLabel(p: {
  enabled: boolean;
  active: boolean;
  startsOn: string | null;
  endsOn: string | null;
  timeZone: string;
}): { text: string; tone: "on" | "off" } {
  if (!p.enabled || !p.startsOn || !p.endsOn)
    return { text: "Off", tone: "off" };
  if (p.active)
    return { text: `Active until ${dayLabel(p.endsOn)}`, tone: "on" };
  const today = isoDayIn(new Date(), p.timeZone);
  return p.startsOn > today
    ? { text: `Starts ${dayLabel(p.startsOn)}`, tone: "off" }
    : { text: `Ended ${dayLabel(p.endsOn)}`, tone: "off" };
}

export const STATUS_LABELS: Record<RewardDisplayStatus, string> = {
  PENDING: "Pending",
  READY: "Ready",
  APPROVED: "Approved",
  PAID: "Paid",
  VOID: "Void",
};
