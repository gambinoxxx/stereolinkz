import "server-only";

import type { BoardListItem } from "@/features/boards/history";
import { listBoards } from "@/features/boards/queries";
import {
  type CurrencyListItem,
  listCurrenciesWithRates,
} from "@/features/currencies/queries";
import {
  type CryptoChangeRow,
  type ForexChangeRow,
  mergeRateChanges,
  type PofChangeRow,
  type RateChange,
} from "@/features/dashboard/changes";
import {
  type BankOption,
  listActiveBankOptions,
  listPofRates,
  type PofBankItem,
} from "@/features/pof-rates/queries";
import { startOfDayInTimeZone } from "@/lib/format";
import { db } from "@/lib/server/db";

export const RECENT_CHANGES = 5;
export const RECENT_BOARDS = 3;

export type DashboardData = {
  timeZone: string;
  now: string; // ISO, the request time
  stats: {
    currencies: { active: number; total: number };
    banks: { active: number; total: number };
    boardsToday: { count: number; lastAt: string | null };
    lastChange: RateChange | null;
  };
  forex: CurrencyListItem[];
  pof: PofBankItem[];
  bankOptions: BankOption[]; // the POF drawer's select
  boards: BoardListItem[];
  changes: RateChange[];
};

// Postgres timestamp(3) as text ("2026-09-27 09:25:00.5", UTC) → ISO.
const iso = (text: string) =>
  new Date(`${text.replace(" ", "T")}Z`).toISOString();

// The newest `limit` forex rates with each one's previous rate for the same
// currency (LAG over that currency's history), org-scoped. One query.
async function recentForexChanges(
  organizationId: string,
  limit: number,
): Promise<ForexChangeRow[]> {
  const rows = await db.$queryRaw<
    {
      id: string;
      at: string;
      code: string;
      buy: string;
      sell: string;
      prev_buy: string | null;
      prev_sell: string | null;
    }[]
  >`
    SELECT id, at, code, buy, sell, prev_buy, prev_sell FROM (
      SELECT r.id, r."createdAt" AS ts, r."createdAt"::text AS at, c.code,
             r.buy::text AS buy, r.sell::text AS sell,
             LAG(r.buy::text) OVER w AS prev_buy,
             LAG(r.sell::text) OVER w AS prev_sell
      FROM "ForexRate" r
      JOIN "Currency" c ON c.id = r."currencyId"
      WHERE c."organizationId" = ${organizationId}
      WINDOW w AS (PARTITION BY r."currencyId" ORDER BY r."createdAt", r.id)
    ) x
    ORDER BY ts DESC, id DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    at: iso(r.at),
    code: r.code,
    buy: r.buy,
    sell: r.sell,
    prevBuy: r.prev_buy,
    prevSell: r.prev_sell,
  }));
}

// The same for crypto rates, per coin. One query.
async function recentCryptoChanges(
  organizationId: string,
  limit: number,
): Promise<CryptoChangeRow[]> {
  const rows = await db.$queryRaw<
    {
      id: string;
      at: string;
      ticker: string;
      buy: string;
      sell: string;
      prev_buy: string | null;
      prev_sell: string | null;
    }[]
  >`
    SELECT id, at, ticker, buy, sell, prev_buy, prev_sell FROM (
      SELECT r.id, r."createdAt" AS ts, r."createdAt"::text AS at, c.ticker,
             r.buy::text AS buy, r.sell::text AS sell,
             LAG(r.buy::text) OVER w AS prev_buy,
             LAG(r.sell::text) OVER w AS prev_sell
      FROM "CryptoRate" r
      JOIN "Coin" c ON c.id = r."coinId"
      WHERE c."organizationId" = ${organizationId}
      WINDOW w AS (PARTITION BY r."coinId" ORDER BY r."createdAt", r.id)
    ) x
    ORDER BY ts DESC, id DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    at: iso(r.at),
    ticker: r.ticker,
    buy: r.buy,
    sell: r.sell,
    prevBuy: r.prev_buy,
    prevSell: r.prev_sell,
  }));
}

// The same for POF rates, per bank. One query.
async function recentPofChanges(
  organizationId: string,
  limit: number,
): Promise<PofChangeRow[]> {
  const rows = await db.$queryRaw<
    {
      id: string;
      at: string;
      label: string;
      rate: string;
      prev_rate: string | null;
    }[]
  >`
    SELECT id, at, label, rate, prev_rate FROM (
      SELECT r.id, r."createdAt" AS ts, r."createdAt"::text AS at,
             COALESCE(b."shortName", b.name) AS label,
             r.rate::text AS rate,
             LAG(r.rate::text) OVER w AS prev_rate
      FROM "PofRate" r
      JOIN "Bank" b ON b.id = r."bankId"
      WHERE b."organizationId" = ${organizationId}
      WINDOW w AS (PARTITION BY r."bankId" ORDER BY r."createdAt", r.id)
    ) x
    ORDER BY ts DESC, id DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    at: iso(r.at),
    bankLabel: r.label,
    rate: r.rate,
    prevRate: r.prev_rate,
  }));
}

// Everything the dashboard shows, scoped to the org, in one round of
// parallel queries. "Today" starts at midnight in the org's time zone.
export async function getDashboard(
  organizationId: string,
  now: Date,
): Promise<DashboardData> {
  const { timezone } = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { timezone: true },
  });
  const today = startOfDayInTimeZone(now, timezone);

  const [
    currencyCounts,
    activeBanks,
    totalBanks,
    boardsToday,
    lastBoard,
    forexChanges,
    pofChanges,
    cryptoChanges,
    forex,
    pof,
    bankOptions,
    boards,
  ] = await Promise.all([
    db.currency.groupBy({
      by: ["status"],
      where: { organizationId, status: { not: "ARCHIVED" } },
      _count: { _all: true },
    }),
    db.bank.count({
      where: {
        organizationId,
        status: "ACTIVE",
        pofActive: true,
        pofRates: { some: {} },
      },
    }),
    db.bank.count({
      where: {
        organizationId,
        status: { not: "ARCHIVED" },
        pofRates: { some: {} },
      },
    }),
    db.rateBoard.count({
      where: { organizationId, createdAt: { gte: today } },
    }),
    db.rateBoard.findFirst({
      where: { organizationId, createdAt: { gte: today } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    recentForexChanges(organizationId, RECENT_CHANGES),
    recentPofChanges(organizationId, RECENT_CHANGES),
    recentCryptoChanges(organizationId, RECENT_CHANGES),
    listCurrenciesWithRates(organizationId, "ACTIVE"),
    listPofRates(organizationId, "active"),
    listActiveBankOptions(organizationId),
    listBoards(organizationId, { limit: RECENT_BOARDS }),
  ]);

  const changes = mergeRateChanges(
    forexChanges,
    pofChanges,
    cryptoChanges,
    RECENT_CHANGES,
  );
  const count = (status: string) =>
    currencyCounts.find((c) => c.status === status)?._count._all ?? 0;

  return {
    timeZone: timezone,
    now: now.toISOString(),
    stats: {
      currencies: {
        active: count("ACTIVE"),
        total: count("ACTIVE") + count("INACTIVE"),
      },
      banks: { active: activeBanks, total: totalBanks },
      boardsToday: {
        count: boardsToday,
        lastAt: lastBoard?.createdAt.toISOString() ?? null,
      },
      lastChange: changes[0] ?? null,
    },
    forex: forex.currencies,
    pof: pof.banks,
    bankOptions,
    boards: boards.boards,
    changes,
  };
}
