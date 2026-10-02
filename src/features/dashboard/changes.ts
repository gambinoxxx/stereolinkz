// Recent rate changes on the dashboard: ForexRate, PofRate and CryptoRate
// rows, each
// with the previous rate of the same currency or bank (read with LAG in
// SQL), merged newest first. Pure; values are decimal strings.
import { compareDecimalStrings } from "@/lib/decimal";
import { formatPercent, formatRate } from "@/lib/format";

export type ForexChangeRow = {
  id: string;
  at: string; // ISO
  code: string;
  buy: string;
  sell: string;
  prevBuy: string | null; // null: the first rate for this currency
  prevSell: string | null;
};

// Coins: naira per $1, the same buy/sell shape as forex.
export type CryptoChangeRow = Omit<ForexChangeRow, "code"> & { ticker: string };

export type PofChangeRow = {
  id: string;
  at: string;
  bankLabel: string; // short name, else name
  rate: string;
  prevRate: string | null;
};

export type RateChange = {
  id: string;
  at: string;
  label: string; // "USD", "Wema POF"
  from: string | null; // "1,360 / 1,374"; null for a first rate
  to: string; // "1,365 / 1,378"
  direction: "up" | "down" | "flat";
};

const dir = (c: number) => (c > 0 ? "up" : c < 0 ? "down" : "flat");

function forexChange(row: ForexChangeRow): RateChange {
  return pairChange(row, row.code);
}

function cryptoChange(row: CryptoChangeRow): RateChange {
  return pairChange(row, row.ticker);
}

// Buy / sell pairs (forex and crypto).
function pairChange(
  row: Omit<ForexChangeRow, "code">,
  label: string,
): RateChange {
  const to = `${formatRate(row.buy)} / ${formatRate(row.sell)}`;
  if (row.prevBuy === null || row.prevSell === null)
    return {
      id: row.id,
      at: row.at,
      label,
      from: null,
      to,
      direction: "flat",
    };
  // Sell leads (it is what customers pay); buy decides when sell is level.
  const sell = compareDecimalStrings(row.sell, row.prevSell);
  return {
    id: row.id,
    at: row.at,
    label,
    from: `${formatRate(row.prevBuy)} / ${formatRate(row.prevSell)}`,
    to,
    direction: dir(
      sell !== 0 ? sell : compareDecimalStrings(row.buy, row.prevBuy),
    ),
  };
}

function pofChange(row: PofChangeRow): RateChange {
  return {
    id: row.id,
    at: row.at,
    label: `${row.bankLabel} POF`,
    from: row.prevRate === null ? null : formatPercent(row.prevRate),
    to: formatPercent(row.rate),
    direction:
      row.prevRate === null
        ? "flat"
        : dir(compareDecimalStrings(row.rate, row.prevRate)),
  };
}

// Newest first across the three tables, `limit` in all. Each list is
// already the newest `limit` of its table, so the merge never misses a row.
export function mergeRateChanges(
  forex: ForexChangeRow[],
  pof: PofChangeRow[],
  crypto: CryptoChangeRow[],
  limit: number,
): RateChange[] {
  return [
    ...forex.map(forexChange),
    ...pof.map(pofChange),
    ...crypto.map(cryptoChange),
  ]
    .sort((a, b) =>
      a.at === b.at ? (a.id < b.id ? 1 : -1) : a.at < b.at ? 1 : -1,
    )
    .slice(0, limit);
}
