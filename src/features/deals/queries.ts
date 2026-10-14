import "server-only";

// The team's reads for /admin/deals (Invariant 7: every query is scoped by
// organizationId, after requireMember() in the page).
import { dealDetailsV1 } from "@/features/deals/schema";
import { decodeCursor, encodeCursor } from "@/features/boards/history";
import type {
  DealService,
  DealStatus,
  Prisma,
} from "@/generated/prisma/client";
import { db } from "@/lib/server/db";
import { startOfDayInTimeZone } from "@/lib/format";
import { getUserDisplayName } from "@/lib/server/users";

export const DEALS_PAGE_SIZE = 20;
export const PAYMENT_RECEIVED_ACTION_MINUTES = 30;

export const DEAL_FILTERS = ["active", "needs", "completed", "all"] as const;
export type DealFilter = (typeof DEAL_FILTERS)[number];

// The queue groups the forex pair, like Settings and the website.
export const SERVICE_FILTERS: Record<string, DealService[]> = {
  "school-fees": ["SCHOOL_FEES"],
  "pay-abroad": ["INTL_PAYMENT"],
  pof: ["POF"],
  forex: ["FOREX_SELL", "FOREX_BUY"],
};

const CLOSED: DealStatus[] = ["COMPLETED", "CANCELLED", "PAID_OUT", "EXPIRED"];

// NEW deals, and payments received but not moved on for 30 minutes.
function needsActionWhere(now: Date): Prisma.DealWhereInput {
  return {
    OR: [
      { status: "NEW" },
      {
        status: "PAYMENT_RECEIVED",
        statusChangedAt: {
          lt: new Date(
            now.getTime() - PAYMENT_RECEIVED_ACTION_MINUTES * 60_000,
          ),
        },
      },
    ],
  };
}

export async function countActiveDeals(organizationId: string) {
  return db.deal.count({
    where: { organizationId, status: { notIn: CLOSED } },
  });
}

export async function countDealsNeedingAction(
  organizationId: string,
  now = new Date(),
) {
  return db.deal.count({ where: { organizationId, ...needsActionWhere(now) } });
}

export type Member = {
  id: string;
  name: string;
  initial: string;
  index: number;
};

export async function listMembers(organizationId: string): Promise<Member[]> {
  const rows = await db.membership.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, clerkUserId: true },
  });
  return Promise.all(
    rows.map(async (m, index) => {
      const name = await getUserDisplayName(m.clerkUserId);
      return {
        id: m.id,
        name,
        initial: name.trim().charAt(0).toUpperCase() || "?",
        index,
      };
    }),
  );
}

export type DealRow = {
  ref: string;
  service: DealService;
  status: DealStatus;
  customerName: string;
  amount: string;
  currency: string;
  quotedNaira: string | null;
  agreedNaira: string | null;
  statusChangedAt: string;
  createdAt: string;
  agreedAt: string | null;
  ownerId: string | null;
  summary: string | null; // "Leeds", "China", "Providus"
  customerPaid: boolean;
};

export type DealListParams = {
  filter: DealFilter;
  q?: string;
  service?: string;
  owner?: string; // membership id, or "none"
  cursor?: string;
};

function summaryOf(details: unknown): string | null {
  const parsed = dealDetailsV1.safeParse(details);
  if (!parsed.success) return null;
  const d = parsed.data;
  if (d.service === "SCHOOL_FEES") return d.schoolName;
  if (d.service === "INTL_PAYMENT") return d.country;
  if (d.service === "POF") return d.bankName ?? null;
  return "transfer";
}

export async function listDeals(
  organizationId: string,
  params: DealListParams,
  now = new Date(),
) {
  const where: Prisma.DealWhereInput[] = [{ organizationId }];
  if (params.filter === "active") where.push({ status: { notIn: CLOSED } });
  if (params.filter === "needs") where.push(needsActionWhere(now));
  if (params.filter === "completed") where.push({ status: "COMPLETED" });
  const services = params.service ? SERVICE_FILTERS[params.service] : undefined;
  if (services) where.push({ service: { in: services } });
  if (params.owner === "none") where.push({ ownerMembershipId: null });
  else if (params.owner) where.push({ ownerMembershipId: params.owner });
  const q = params.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.push({
      OR: [
        { ref: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        // Numbers are stored "+234 803 555 0192": match the last digits typed.
        ...(digits.length >= 4
          ? [{ customerWhatsapp: { contains: digits.slice(-4) } }]
          : []),
      ],
    });
  }
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  if (cursor)
    where.push({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    });

  const rows = await db.deal.findMany({
    where: { AND: where },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: DEALS_PAGE_SIZE + 1,
    select: {
      id: true,
      ref: true,
      service: true,
      status: true,
      customerName: true,
      customerWhatsapp: true,
      amount: true,
      currency: true,
      quotedNaira: true,
      agreedNaira: true,
      statusChangedAt: true,
      createdAt: true,
      agreedAt: true,
      ownerMembershipId: true,
      details: true,
      events: {
        where: { type: "CUSTOMER_PAID" },
        select: { id: true },
        take: 1,
      },
    },
  });
  // Phone search matched on the last 4 digits; keep only full matches.
  const digits = q?.replace(/\D/g, "") ?? "";
  const filtered =
    digits.length >= 4
      ? rows.filter(
          (r) =>
            r.ref.toLowerCase().includes(q!.toLowerCase()) ||
            r.customerName.toLowerCase().includes(q!.toLowerCase()) ||
            r.customerWhatsapp
              .replace(/\D/g, "")
              .includes(digits.replace(/^0/, "")),
        )
      : rows;
  const page = filtered.slice(0, DEALS_PAGE_SIZE);
  const last = rows.length > DEALS_PAGE_SIZE ? rows[DEALS_PAGE_SIZE - 1] : null;
  return {
    deals: page.map((r): DealRow => ({
      ref: r.ref,
      service: r.service,
      status: r.status,
      customerName: r.customerName,
      amount: r.amount.toString(),
      currency: r.currency,
      quotedNaira: r.quotedNaira?.toString() ?? null,
      agreedNaira: r.agreedNaira?.toString() ?? null,
      statusChangedAt: r.statusChangedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      agreedAt: r.agreedAt?.toISOString() ?? null,
      ownerId: r.ownerMembershipId,
      summary: summaryOf(r.details),
      customerPaid: r.events.length > 0,
    })),
    nextCursor: last
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null,
  };
}

export type DealStats = {
  newCount: number;
  oldestNewAt: string | null;
  awaitingCount: number;
  awaitingNaira: string; // sum of agreed naira (exact)
  completedToday: number;
  completedTodayNaira: string;
};

export async function getDealStats(
  organizationId: string,
  timeZone: string,
  now = new Date(),
): Promise<DealStats> {
  const today = startOfDayInTimeZone(now, timeZone);
  const [news, awaiting, completed] = await Promise.all([
    db.deal.aggregate({
      where: { organizationId, status: "NEW" },
      _count: true,
      _min: { createdAt: true },
    }),
    db.deal.aggregate({
      where: { organizationId, status: "AWAITING_PAYMENT" },
      _count: true,
      _sum: { agreedNaira: true },
    }),
    db.deal.aggregate({
      where: {
        organizationId,
        status: "COMPLETED",
        statusChangedAt: { gte: today },
      },
      _count: true,
      _sum: { agreedNaira: true },
    }),
  ]);
  return {
    newCount: news._count,
    oldestNewAt: news._min.createdAt?.toISOString() ?? null,
    awaitingCount: awaiting._count,
    awaitingNaira: awaiting._sum.agreedNaira?.toString() ?? "0",
    completedToday: completed._count,
    completedTodayNaira: completed._sum.agreedNaira?.toString() ?? "0",
  };
}

// One deal for the team: everything, including internal notes.
export async function getDealForTeam(organizationId: string, ref: string) {
  const deal = await db.deal.findUnique({
    where: { organizationId_ref: { organizationId, ref } },
    select: {
      id: true,
      ref: true,
      service: true,
      status: true,
      customerName: true,
      customerWhatsapp: true,
      customerEmail: true,
      details: true,
      currency: true,
      amount: true,
      quotedRate: true,
      quotedNaira: true,
      quotedAt: true,
      quotedBoardId: true,
      agreedRate: true,
      feeNaira: true,
      agreedNaira: true,
      agreedAt: true,
      agreedById: true,
      paymentAccountId: true,
      payoutBank: true,
      payoutAccountNumber: true,
      payoutAccountName: true,
      payoutReference: true,
      ownerMembershipId: true,
      cancelReason: true,
      statusChangedAt: true,
      createdAt: true,
      files: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          originalName: true,
          byteSize: true,
          uploadedBy: true,
          createdAt: true,
        },
      },
      events: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          fromStatus: true,
          toStatus: true,
          message: true,
          data: true,
          actorType: true,
          actorMembershipId: true,
          createdAt: true,
        },
      },
    },
  });
  if (!deal) return null;

  const [accounts, pastDeals, board] = await Promise.all([
    db.paymentAccount.findMany({
      where: {
        organizationId,
        OR: [
          { active: true, services: { has: deal.service } },
          ...(deal.paymentAccountId ? [{ id: deal.paymentAccountId }] : []),
        ],
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        bank: true,
        accountNumber: true,
        accountName: true,
        currency: true,
        active: true,
      },
    }),
    db.deal.findMany({
      where: {
        organizationId,
        customerWhatsapp: deal.customerWhatsapp,
        id: { not: deal.id },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { ref: true, service: true, status: true, createdAt: true },
    }),
    deal.quotedBoardId
      ? db.rateBoard.findFirst({
          where: { id: deal.quotedBoardId, organizationId },
          select: { snapshot: true },
        })
      : Promise.resolve(null),
  ]);
  const boardTime =
    (board?.snapshot as { content?: { timeLabel?: string } } | null)?.content
      ?.timeLabel ?? null;
  const details = dealDetailsV1.safeParse(deal.details);

  return {
    ...deal,
    details: details.success ? details.data : null,
    amount: deal.amount.toString(),
    quotedRate: deal.quotedRate?.toString() ?? null,
    quotedNaira: deal.quotedNaira?.toString() ?? null,
    quotedAt: deal.quotedAt?.toISOString() ?? null,
    quotedBoardTime: boardTime,
    agreedRate: deal.agreedRate?.toString() ?? null,
    feeNaira: deal.feeNaira?.toString() ?? null,
    agreedNaira: deal.agreedNaira?.toString() ?? null,
    agreedAt: deal.agreedAt?.toISOString() ?? null,
    statusChangedAt: deal.statusChangedAt.toISOString(),
    createdAt: deal.createdAt.toISOString(),
    files: deal.files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    })),
    events: deal.events.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    accounts,
    pastDeals: pastDeals.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}
export type TeamDeal = NonNullable<Awaited<ReturnType<typeof getDealForTeam>>>;
