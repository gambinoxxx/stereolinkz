import "server-only";

// Referral reads (Phase 13c): the programme settings, staff codes and the
// rewards ledger. Every query is scoped by organization. The ledger reads
// only the reward's own snapshot (deal ref, service, dates, amounts,
// status, code), never the referred customer's name, number, email or
// files: LEDGER_SELECT (ledger-select.ts) is the whole list, held to
// that by a test.
import {
  bpsToPct,
  displayStatus,
  maskPhone,
  pendingReason,
  type RewardDisplayStatus,
} from "@/features/referrals/rules";
import type { DealService } from "@/generated/prisma/enums";
import { LEDGER_SELECT } from "@/features/referrals/ledger-select";
import { attachOutcome } from "@/features/referrals/outcome";
import { db } from "@/lib/server/db";
import { getUserDisplayName } from "@/lib/server/users";
import { monthInTimeZone } from "@/lib/format";

export type LedgerRow = {
  id: string;
  dealRef: string;
  service: DealService;
  code: string;
  referrerKey: string;
  referrer: string; // the team member's name, or the customer's name and masked number
  pct: string;
  profitNaira: string;
  amountNaira: string;
  status: RewardDisplayStatus;
  note: string | null; // why it's still pending, or the void reason
  readyOn: string | null; // PENDING, not flagged: when it becomes Ready
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

// A customer referrer as the team sees them: name and masked number.
const customerLabel = (name: string | null, whatsapp: string | null) =>
  `${name ?? "Customer"} · ${maskPhone(whatsapp ?? "")}`;

async function customerNames(organizationId: string) {
  const codes = await db.referralCode.findMany({
    where: { organizationId, kind: "CUSTOMER" },
    select: { customerName: true, customerWhatsapp: true },
  });
  return codes.map(
    (c) =>
      [
        `w:${c.customerWhatsapp}`,
        customerLabel(c.customerName, c.customerWhatsapp),
      ] as const,
  );
}

export async function getLedger(
  organizationId: string,
  filters: LedgerFilters,
  now = new Date(),
): Promise<{
  rows: LedgerRow[];
  totals: Record<"PENDING" | "READY" | "APPROVED" | "PAID", string>;
  counts: Record<RewardDisplayStatus, number>; // before the status filter
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
  for (const [key, name] of await customerNames(organizationId))
    names.set(key, name);
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
      readyOn:
        r.status === "PENDING" && !r.flag
          ? new Date(
              Math.max(r.holdUntil.getTime(), r.notBefore?.getTime() ?? 0),
            ).toISOString()
          : null,
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
  const counts = { PENDING: 0, READY: 0, APPROVED: 0, PAID: 0, VOID: 0 };
  for (const r of all) {
    counts[r.status]++;
    if (r.status !== "VOID") totals[r.status] += BigInt(r.amountNaira);
  }
  return {
    rows,
    totals: {
      PENDING: totals.PENDING.toString(),
      READY: totals.READY.toString(),
      APPROVED: totals.APPROVED.toString(),
      PAID: totals.PAID.toString(),
    },
    counts,
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

export type CampaignRow = {
  id: string;
  name: string;
  startsOn: string; // "2026-11-01", org time zone
  endsOn: string; // the last day it runs
  pct: string; // "15"
  includeCrypto: boolean;
  active: boolean;
  status: "running" | "scheduled" | "ended" | "off";
  deals: number;
};

const dayIn = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

// Settings → Referrals: the campaigns, newest first, and the programme
// rules that apply to every campaign.
export async function getReferralSettings(
  organizationId: string,
  now = new Date(),
): Promise<{
  campaigns: CampaignRow[];
  holdDays: number;
  monthlyCap: string | null;
  timeZone: string;
}> {
  const [org, campaigns] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        timezone: true,
        referralHoldDays: true,
        referralMonthlyCapNaira: true,
      },
    }),
    db.referralCampaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        rewardBps: true,
        includeCrypto: true,
        active: true,
        _count: { select: { deals: true } },
      },
    }),
  ]);
  return {
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      startsOn: dayIn(c.startsAt, org.timezone),
      endsOn: dayIn(new Date(c.endsAt.getTime() - 1), org.timezone),
      pct: bpsToPct(c.rewardBps),
      includeCrypto: c.includeCrypto,
      active: c.active,
      status: !c.active
        ? "off"
        : now < c.startsAt
          ? "scheduled"
          : now >= c.endsAt
            ? "ended"
            : "running",
      deals: c._count.deals,
    })),
    holdDays: org.referralHoldDays,
    monthlyCap: org.referralMonthlyCapNaira?.toFixed() ?? null,
    timeZone: org.timezone,
  };
}

export type StaffCodeRow = {
  id: string;
  code: string;
  active: boolean;
  membershipId: string;
  memberName: string;
  deals: number; // attached now
  used: number; // deals that came with the code, attached or not
  createdAt: string;
};

// Deals that came with each code (typed or from the link), attached or
// not: one attach-outcome event per deal (`data.applied` is set on those
// only, never on reward events).
export async function codeUses(
  organizationId: string,
): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ code: string; used: number }[]>`
    SELECT e."data"->>'code' AS code, COUNT(DISTINCT e."dealId")::int AS used
    FROM "DealEvent" e
    JOIN "Deal" d ON d."id" = e."dealId"
    WHERE d."organizationId" = ${organizationId}
      AND e."type" = 'REFERRAL'
      AND e."data" ? 'applied'
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.code, r.used]));
}

export async function listStaffCodes(
  organizationId: string,
): Promise<StaffCodeRow[]> {
  const [codes, names, uses] = await Promise.all([
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
    codeUses(organizationId),
  ]);
  return codes.map((c) => ({
    id: c.id,
    code: c.code,
    active: c.active,
    membershipId: c.membershipId!,
    memberName: names.get(`m:${c.membershipId}`) ?? "Team member",
    deals: c._count.deals,
    used: Math.max(uses.get(c.code) ?? 0, c._count.deals),
    createdAt: c.createdAt.toISOString(),
  }));
}

// A deal's referral details for the admin deal page: its code (or why
// none is attached) and campaign, our profit and the reward, and the customer's own code (from
// a completed deal) with the date its private link was last made.
export async function getDealReferral(dealId: string, now = new Date()) {
  const d = await db.deal.findUnique({
    where: { id: dealId },
    select: {
      organizationId: true,
      customerWhatsapp: true,
      profitNaira: true,
      referralCode: { select: { code: true, kind: true } },
      referralCampaign: { select: { name: true } },
      referralReward: { select: LEDGER_SELECT },
      events: {
        where: { type: { in: ["REFERRAL", "REFERRAL_REMOVED"] } },
        orderBy: { createdAt: "asc" },
        select: { type: true, message: true, data: true },
      },
    },
  });
  if (!d) return null;
  const own = await db.referralCode.findFirst({
    where: {
      organizationId: d.organizationId,
      kind: "CUSTOMER",
      customerWhatsapp: d.customerWhatsapp,
      active: true,
    },
    select: { code: true, pageTokenAt: true },
  });
  const r = d.referralReward;
  return {
    code: d.referralCode?.code ?? null,
    outcome: attachOutcome(d.referralCode?.code ?? null, d.events),
    campaign: d.referralCampaign?.name ?? null,
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
    customerCode: own
      ? { code: own.code, linkMadeAt: own.pageTokenAt?.toISOString() ?? null }
      : null,
  };
}

export type CodeRow = {
  id: string;
  code: string;
  kind: "STAFF" | "CUSTOMER";
  active: boolean;
  owner: string; // staff name, or customer name and masked number
  deals: number; // attached now
  used: number; // came with the code, attached or not
  rewards: number; // not void
  rewardsNaira: string;
  paidNaira: string;
};

// Admin → Referrals: every code, staff and customer, with its deals and
// rewards. The owner's number is masked even here.
export async function listReferralCodes(
  organizationId: string,
): Promise<CodeRow[]> {
  const [codes, names] = await Promise.all([
    db.referralCode.findMany({
      where: { organizationId },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      take: 500,
      select: {
        id: true,
        code: true,
        kind: true,
        active: true,
        membershipId: true,
        customerName: true,
        customerWhatsapp: true,
        _count: { select: { deals: true } },
        rewards: {
          where: { status: { not: "VOID" } },
          select: { amountNaira: true, status: true },
        },
      },
    }),
    referrerNames(organizationId),
  ]);
  const uses = await codeUses(organizationId);
  return codes.map((c) => {
    let total = BigInt(0);
    let paid = BigInt(0);
    for (const r of c.rewards) {
      total += BigInt(r.amountNaira.toFixed());
      if (r.status === "PAID") paid += BigInt(r.amountNaira.toFixed());
    }
    return {
      id: c.id,
      code: c.code,
      kind: c.kind,
      active: c.active,
      owner:
        c.kind === "STAFF"
          ? (names.get(`m:${c.membershipId}`) ?? "Team member")
          : customerLabel(c.customerName, c.customerWhatsapp),
      deals: c._count.deals,
      used: Math.max(uses.get(c.code) ?? 0, c._count.deals),
      rewards: c.rewards.length,
      rewardsNaira: total.toString(),
      paidNaira: paid.toString(),
    };
  });
}
