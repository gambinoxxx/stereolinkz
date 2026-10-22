// Display strings for the referral programme (Phase 13c), shared by the
// admin pages.
import type {
  AttachSkip,
  RewardDisplayStatus,
} from "@/features/referrals/rules";

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

// A campaign's state in words: "Active until 20 Dec 2026", "Starts 1 Nov
// 2026", "Ended 20 Dec 2026" or "Off".
export function campaignLabel(c: {
  status: "running" | "scheduled" | "ended" | "off";
  startsOn: string;
  endsOn: string;
}): string {
  switch (c.status) {
    case "running":
      return `Active until ${dayLabel(c.endsOn)}`;
    case "scheduled":
      return `Starts ${dayLabel(c.startsOn)}`;
    case "ended":
      return `Ended ${dayLabel(c.endsOn)}`;
    case "off":
      return "Off";
  }
}

export const STATUS_LABELS: Record<RewardDisplayStatus, string> = {
  PENDING: "Pending",
  READY: "Ready",
  APPROVED: "Approved",
  PAID: "Paid",
  VOID: "Void",
};

// The deal page's "Not attached: …".
export const ATTACH_SKIP_LABELS: Record<
  AttachSkip | "no_code" | "removed",
  string
> = {
  no_campaign: "no active programme",
  unknown_code: "unknown code",
  inactive_code: "inactive code",
  staff_own_number: "staff’s own number",
  customer_own_number: "the code owner’s own number",
  not_new_customer: "not a new customer",
  service_not_eligible: "service not eligible",
  no_code: "no code given",
  removed: "removed by the team",
};
