import "server-only";

import type { RecordStatus } from "@/generated/prisma/enums";
import { toDecimalString } from "@/lib/decimal";
import { db } from "@/lib/server/db";

export type CryptoRateItem = {
  id: string;
  buy: string; // decimal string, naira per $1
  sell: string;
  createdAt: string; // ISO
};

export type CoinListItem = {
  id: string;
  ticker: string;
  name: string;
  networks: string[];
  iconUrl: string | null;
  badgeColor: string | null;
  status: RecordStatus;
  // Newest first, at most 4: [0] current, [1] previous (change arrows),
  // all of them the edit drawer's history (the Phase 4 shape).
  rates: CryptoRateItem[];
};

export type CoinList = {
  timeZone: string;
  coins: CoinListItem[];
};

const RECENT_RATES = 4;

// Non-archived coins in board order, each with its latest rates, in one
// query. Callers pass requireMember()'s organizationId.
export async function listCoinsWithRates(
  organizationId: string,
  status?: "ACTIVE" | "INACTIVE",
): Promise<CoinList> {
  const [organization, coins] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    }),
    db.coin.findMany({
      where: { organizationId, status: status ?? { not: "ARCHIVED" } },
      orderBy: [{ sortOrder: "asc" }, { ticker: "asc" }],
      include: {
        rates: {
          orderBy: { createdAt: "desc" },
          take: RECENT_RATES,
          select: { id: true, buy: true, sell: true, createdAt: true },
        },
      },
    }),
  ]);

  return {
    timeZone: organization.timezone,
    coins: coins.map((coin) => ({
      id: coin.id,
      ticker: coin.ticker,
      name: coin.name,
      networks: coin.networks,
      iconUrl: coin.iconUrl,
      badgeColor: coin.badgeColor,
      status: coin.status,
      rates: coin.rates.map((rate) => ({
        id: rate.id,
        buy: toDecimalString(rate.buy),
        sell: toDecimalString(rate.sell),
        createdAt: rate.createdAt.toISOString(),
      })),
    })),
  };
}
