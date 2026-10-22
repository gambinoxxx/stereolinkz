// The referral programme's rules (Phase 13c), pure: shared by the server,
// the forms and the tests. Money is decimal strings (no floats); the
// reward is a share of OUR profit on a deal, never of the trade amount.
import type {
  DealService,
  ReferralRewardStatus,
} from "@/generated/prisma/enums";
import { multiplyDecimalStrings } from "@/lib/decimal";

// stereolinkz.com/r/LYDIA (or ?ref=LYDIA) → this first-party httpOnly
// cookie, 60 days (features/referrals/link.ts).
export const REF_COOKIE = "slz_ref";
export const REF_COOKIE_DAYS = 60;

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

// ── Customer side (campaigns, customer codes) ─────────────────────────

// Completing (or paying out) a referred deal needs our profit: the reward
// is a share of it. Refused without one, on the server and in the panel.
export const PROFIT_REQUIRED =
  "This deal has a referral code: enter our profit on it (0 if none).";

// Why a code that came with a deal (typed, or from the link's cookie)
// wasn't attached. Stored on the deal's REFERRAL event (`data.skip`) and
// shown to the team on the deal page; never to the customer.
export const ATTACH_SKIPS = [
  "no_campaign",
  "unknown_code",
  "inactive_code",
  "staff_own_number",
  "customer_own_number",
  "not_new_customer",
  "service_not_eligible",
] as const;
export type AttachSkip = (typeof ATTACH_SKIPS)[number];

// Only a referred customer's FIRST deal earns a reward. One named switch,
// so the rule can change later without hunting for it.
export const FIRST_DEAL_ONLY = true;

// Customer codes: "SLZ" + 5 characters from an alphabet with no 0/O, 1/I
// or L, so a code read aloud or typed from a photo can't be mistaken.
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CUSTOMER_CODE_PATTERN =
  /^SLZ[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/;

// From random bytes (crypto.randomBytes in the caller), with rejection
// sampling so every character is equally likely. Null if the bytes ran
// out (the caller asks again).
export function customerCodeFrom(bytes: Uint8Array): string | null {
  const limit = 256 - (256 % CODE_ALPHABET.length); // 248: no modulo bias
  let code = "SLZ";
  for (const b of bytes) {
    if (b >= limit) continue;
    code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (code.length === 8) return code;
  }
  return null;
}

export type Campaign = {
  id: string;
  active: boolean;
  startsAt: Date;
  endsAt: Date;
  rewardBps: number;
  includeCrypto: boolean;
};

// In force: switched on and now inside its dates.
export function campaignInForce(
  c: Pick<Campaign, "active" | "startsAt" | "endsAt">,
  now: Date,
): boolean {
  return c.active && now >= c.startsAt && now < c.endsAt;
}

// Every deal service counts, except crypto unless the campaign includes it.
export function serviceEligible(
  c: Pick<Campaign, "includeCrypto">,
  service: DealService,
): boolean {
  return service !== "CRYPTO_SELL" || c.includeCrypto;
}

// bps of our profit (1500 = 15%), rounded DOWN to whole naira, exactly:
// rewardFromBps("12345.67", 1500) → "1851".
export function rewardFromBps(profit: string, bps: number): string {
  const product = multiplyDecimalStrings(profit, String(bps));
  if (product.startsWith("-")) return "0";
  const whole = BigInt(product.split(".")[0] || "0");
  return (whole / BigInt(10000)).toString();
}

// "15" from 1500, "12.5" from 1250, for labels and the pct column.
export const bpsToPct = (bps: number) =>
  (bps / 100).toFixed(2).replace(/\.?0+$/, "");

// For the referrer's masked list: "+234 803 123 4567" → "+234 ••• ••• 4567".
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 4
    ? "•••"
    : `+${digits.slice(0, 3)} ••• ••• ${digits.slice(-4)}`;
}
