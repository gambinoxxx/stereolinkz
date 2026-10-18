// The referral programme's rules (Phase 13c), pure: shared by the server,
// the forms and the tests. Money is decimal strings (no floats); the
// reward is a share of OUR profit on a deal, never of the trade amount.
import type {
  DealService,
  ReferralRewardStatus,
} from "@/generated/prisma/enums";
import { multiplyDecimalStrings } from "@/lib/decimal";

// stereolinkz.com/?ref=LYDIA → this first-party cookie, 30 days.
export const REF_COOKIE = "slz_ref";
export const REF_COOKIE_DAYS = 30;

export const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

// "  lydia " → "LYDIA"; anything else → null.
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export type ProgrammeSettings = {
  referralEnabled: boolean;
  referralStartsAt: Date | null;
  referralEndsAt: Date | null;
  referralServices: DealService[];
};

// On only while switched on and now is inside the window.
export function isProgrammeActive(p: ProgrammeSettings, now: Date): boolean {
  return (
    p.referralEnabled &&
    !!p.referralStartsAt &&
    !!p.referralEndsAt &&
    now >= p.referralStartsAt &&
    now < p.referralEndsAt
  );
}

export function acceptsService(
  p: ProgrammeSettings,
  service: DealService,
  now: Date,
): boolean {
  return isProgrammeActive(p, now) && p.referralServices.includes(service);
}

// The window when the programme is switched on without dates: from now,
// for two calendar months.
export function defaultWindow(now: Date): { startsAt: Date; endsAt: Date } {
  const endsAt = new Date(now);
  endsAt.setUTCMonth(endsAt.getUTCMonth() + 2);
  return { startsAt: now, endsAt };
}

// pct % of profit, rounded DOWN to whole naira, exactly:
// rewardAmount("12345.67", "15") → "1851".
export function rewardAmount(profit: string, pct: string): string {
  const product = multiplyDecimalStrings(profit, pct); // profit × pct
  if (product.startsWith("-")) return "0";
  const whole = BigInt(product.split(".")[0] || "0");
  return (whole / BigInt(100)).toString(); // floor((profit × pct) / 100)
}

// Who a reward counts towards for the monthly cap: one team member (all
// their codes) or one customer number.
export function referrerKey(code: {
  kind: "STAFF" | "CUSTOMER";
  membershipId: string | null;
  customerWhatsapp: string | null;
}): string {
  return code.kind === "STAFF"
    ? `m:${code.membershipId}`
    : `w:${code.customerWhatsapp}`;
}

// What the ledger shows. READY is worked out from the dates, never stored.
export type RewardDisplayStatus =
  "PENDING" | "READY" | "APPROVED" | "PAID" | "VOID";

export function displayStatus(
  r: {
    status: ReferralRewardStatus;
    holdUntil: Date;
    notBefore: Date | null;
    flag: string | null;
  },
  now: Date,
): RewardDisplayStatus {
  if (r.status !== "PENDING") return r.status;
  return isApprovable(r, now) && !r.flag ? "READY" : "PENDING";
}

// Approvable: still pending, the hold is over and it isn't capped this
// month. A flagged reward can be approved one at a time, after a check.
export function isApprovable(
  r: { status: ReferralRewardStatus; holdUntil: Date; notBefore: Date | null },
  now: Date,
): boolean {
  return (
    r.status === "PENDING" &&
    now >= r.holdUntil &&
    (!r.notBefore || now >= r.notBefore)
  );
}

// Why a pending reward isn't ready yet, for the ledger.
export function pendingReason(
  r: { holdUntil: Date; notBefore: Date | null; flag: string | null },
  now: Date,
): string | null {
  if (r.flag) return r.flag;
  if (r.notBefore && now < r.notBefore) return "Cap reached: next month";
  if (now < r.holdUntil) return "In the hold period";
  return null;
}

// Would this reward take the referrer past the monthly cap? `monthTotal`
// is their approved + paid total for the month.
export function passesCap(
  cap: string | null,
  monthTotal: string,
  amount: string,
): boolean {
  if (cap === null) return false;
  const total = BigInt(monthTotal.split(".")[0] || "0") + BigInt(amount);
  return total > BigInt(cap.split(".")[0] || "0");
}

export const SELF_REFERRAL_FLAG = "Check: possible self-referral";
export const CAP_FLAG_NOTE = "Cap reached";
