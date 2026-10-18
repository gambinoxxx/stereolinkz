import "server-only";

// Referral reads (Phase 13c): the programme settings, staff codes and the
// rewards ledger. Every query is scoped by organization. The ledger reads
// only the reward's own snapshot (deal ref, service, dates, amounts,
// status, code), never the referred customer's name, number, email or
// files: LEDGER_SELECT (ledger-select.ts) is the whole list, held to
// that by a test.
import {
  displayStatus,
  isProgrammeActive,
  pendingReason,
  type RewardDisplayStatus,
} from "@/features/referrals/rules";
import type { DealService } from "@/generated/prisma/enums";
import { LEDGER_SELECT } from "@/features/referrals/ledger-select";
import { db } from "@/lib/server/db";
import { getUserDisplayName } from "@/lib/server/users";
import { monthInTimeZone } from "@/lib/format";

export type LedgerRow = {
  id: string;
  dealRef: string;
  service: DealService;
  code: string;
  referrerKey: string;
  referrer: string; // the team member's name (Stage B: "Customer")
  pct: string;
  profitNaira: string;
  amountNaira: string;
  status: RewardDisplayStatus;
  note: string | null; // why it's still pending, or the void reason
  flagged: boolean;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  bankReference: string | null;
};

export type LedgerFilters = {
  referrer?: string; // a referrerKey
  status?: RewardDisplayStatus;
  month?: string; // "2026-10", by the reward's date
};

async function referrerNames(organizationId: string) {
  const members = await db.membership.findMany({
    where: { organizationId },
    select: { id: true, clerkUserId: true },
  });
  const names = await Promise.all(
    members.map(
      async (m) =>
        [
          `m:${m.id}` as string,
          await getUserDisplayName(m.clerkUserId),
        ] as const,
    ),
  );
  return new Map(names);
}

export async function getLedger(
  organizationId: string,
  filters: LedgerFilters,
  now = new Date(),
): Promise<{
  rows: LedgerRow[];
  totals: Record<"PENDING" | "READY" | "APPROVED" | "PAID", string>;
  referrers: { key: string; name: string }[];
  timeZone: string;
}> {
  const { timezone } = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { timezone: true },
  });
  const range = filters.month
    ? monthInTimeZone(new Date(`${filters.month}-15T12:00:00Z`), timezone)
    : null;
  const [rewards, names, codes] = await Promise.all([
    db.referralReward.findMany({
      where: {
        organizationId,
        ...(filters.referrer && { referrerKey: filters.referrer }),
        ...(range && { createdAt: { gte: range.start, lt: range.end } }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 500,
      select: LEDGER_SELECT,
    }),
    referrerNames(organizationId),
    db.referralCode.findMany({
      where: { organizationId, kind: "STAFF" },
      select: { membershipId: true },
      distinct: ["membershipId"],
    }),
  ]);
  const all = rewards.map((r): LedgerRow => {
    const status = displayStatus(r, now);
    return {
      id: r.id,
      dealRef: r.dealRef,
      service: r.service,
      code: r.code,
      referrerKey: r.referrerKey,
      referrer: names.get(r.referrerKey) ?? "Customer",
      pct: r.pct.toFixed(),
      profitNaira: r.profitNaira.toFixed(),
      amountNaira: r.amountNaira.toFixed(),
      status,
      note:
        r.status === "VOID"
          ? r.voidReason
          : r.status === "PENDING"
            ? pendingReason(r, now)
            : null,
      flagged: r.status === "PENDING" && !!r.flag,
      createdAt: r.createdAt.toISOString(),
      approvedAt: r.approvedAt?.toISOString() ?? null,
      paidAt: r.paidAt?.toISOString() ?? null,
      bankReference: r.bankReference,
    };
  });
  const rows = filters.status
    ? all.filter((r) => r.status === filters.status)
    : all;
  const totals = {
    PENDING: BigInt(0),
    READY: BigInt(0),
    APPROVED: BigInt(0),
    PAID: BigInt(0),
  };
  for (const r of all)
    if (r.status !== "VOID") totals[r.status] += BigInt(r.amountNaira);
  return {
    rows,
    totals: {
      PENDING: totals.PENDING.toString(),
      READY: totals.READY.toString(),
      APPROVED: totals.APPROVED.toString(),
      PAID: totals.PAID.toString(),
    },
    referrers: codes
      .filter((c) => c.membershipId)
      .map((c) => ({
        key: `m:${c.membershipId}`,
        name: names.get(`m:${c.membershipId}`) ?? "Team member",
      })),
    timeZone: timezone,
  };
}

// Dashboard: rewards the owner can approve (READY) or pay (APPROVED).
export async function rewardsToPay(
  organizationId: string,
  now = new Date(),
): Promise<{ total: string; count: number }> {
  const rows = await db.referralReward.findMany({
    where: { organizationId, status: { in: ["PENDING", "APPROVED"] } },
    select: {
      status: true,
      holdUntil: true,
      notBefore: true,
      flag: true,
      amountNaira: true,
    },
  });
  let total = BigInt(0);
  let count = 0;
  for (const r of rows) {
    const s = displayStatus(r, now);
    if (s === "READY" || s === "APPROVED") {
      total += BigInt(r.amountNaira.toFixed());
      count++;
    }
  }
  return { total: total.toString(), count };
}

export type ProgrammeView = {
  enabled: boolean;
  active: boolean;
  startsOn: string | null; // "2026-10-18", org time zone
  endsOn: string | null; // the last day on
  rewardPct: string;
  holdDays: number;
  newCustomersOnly: boolean;
  monthlyCap: string | null;
  services: DealService[];
  timeZone: string;
};

const dayIn = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

export async function getProgramme(
  organizationId: string,
  now = new Date(),
): Promise<ProgrammeView> {
  const o = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      timezone: true,
      referralEnabled: true,
      referralStartsAt: true,
      referralEndsAt: true,
      referralRewardPct: true,
      referralHoldDays: true,
      referralNewCustomersOnly: true,
      referralMonthlyCapNaira: true,
      referralServices: true,
    },
  });
  return {
    enabled: o.referralEnabled,
    active: isProgrammeActive(o, now),
    startsOn: o.referralStartsAt ? dayIn(o.referralStartsAt, o.timezone) : null,
    // endsAt is the start of the day after the last day.
    endsOn: o.referralEndsAt
      ? dayIn(new Date(o.referralEndsAt.getTime() - 1), o.timezone)
      : null,
    rewardPct: o.referralRewardPct.toFixed(),
    holdDays: o.referralHoldDays,
    newCustomersOnly: o.referralNewCustomersOnly,
    monthlyCap: o.referralMonthlyCapNaira?.toFixed() ?? null,
    services: o.referralServices,
    timeZone: o.timezone,
  };
}

export type StaffCodeRow = {
  id: string;
  code: string;
  active: boolean;
  membershipId: string;
  memberName: string;
  deals: number;
  createdAt: string;
};

export async function listStaffCodes(
  organizationId: string,
): Promise<StaffCodeRow[]> {
  const [codes, names] = await Promise.all([
    db.referralCode.findMany({
      where: { organizationId, kind: "STAFF" },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        active: true,
        membershipId: true,
        createdAt: true,
        _count: { select: { deals: true } },
      },
    }),
    referrerNames(organizationId),
  ]);
  return codes.map((c) => ({
    id: c.id,
    code: c.code,
    active: c.active,
    membershipId: c.membershipId!,
    memberName: names.get(`m:${c.membershipId}`) ?? "Team member",
    deals: c._count.deals,
    createdAt: c.createdAt.toISOString(),
  }));
}

// A deal's referral details for the admin deal page.
export async function getDealReferral(dealId: string, now = new Date()) {
  const d = await db.deal.findUnique({
    where: { id: dealId },
    select: {
      profitNaira: true,
      referralCode: { select: { code: true, kind: true } },
      referralReward: { select: LEDGER_SELECT },
    },
  });
  if (!d) return null;
  const r = d.referralReward;
  return {
    code: d.referralCode?.code ?? null,
    profitNaira: d.profitNaira?.toFixed() ?? null,
    reward: r
      ? {
          amountNaira: r.amountNaira.toFixed(),
          pct: r.pct.toFixed(),
          status: displayStatus(r, now),
          note:
            r.status === "VOID"
              ? r.voidReason
              : r.status === "PENDING"
                ? pendingReason(r, now)
                : null,
        }
      : null,
  };
}
