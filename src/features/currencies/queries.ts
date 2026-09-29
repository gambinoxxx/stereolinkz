import "server-only";

import type { RecordStatus } from "@/generated/prisma/enums";
import { toDecimalString } from "@/lib/decimal";
import { db } from "@/lib/server/db";

export type ForexRateItem = {
  id: string;
  buy: string; // decimal string
  sell: string;
  createdAt: string; // ISO
};

export type CurrencyListItem = {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  flagCode: string | null;
  status: RecordStatus;
  // Newest first, at most 4: [0] is the current rate, [1] the previous one
  // (change arrows), and all of them are the edit drawer's history.
  rates: ForexRateItem[];
};

export type CurrencyList = {
  timeZone: string; // the org's, for "Updated" and history times
  currencies: CurrencyListItem[];
};

export const RECENT_RATES = 4;

// Non-archived currencies in board order, each with its latest rates, in
// one query. Callers pass the organizationId from requireMember().
export async function listCurrenciesWithRates(
  organizationId: string,
  status?: "ACTIVE" | "INACTIVE",
): Promise<CurrencyList> {
  const [organization, currencies] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    }),
    db.currency.findMany({
      where: {
        organizationId,
        status: status ?? { not: "ARCHIVED" },
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
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
    currencies: currencies.map((currency) => ({
      id: currency.id,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      flagCode: currency.flagCode,
      status: currency.status,
      rates: currency.rates.map((rate) => ({
        id: rate.id,
        buy: toDecimalString(rate.buy),
        sell: toDecimalString(rate.sell),
        createdAt: rate.createdAt.toISOString(),
      })),
    })),
  };
}
