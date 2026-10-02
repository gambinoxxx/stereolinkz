// "Now X" on a saved board: each snapshot row against today's rate for the
// same currency or bank. Rates only (POF notes are not compared): the
// detail answers "has the price moved since?". Pure.
import type { BoardSnapshot } from "@/features/boards/snapshot";
import { assertNever } from "@/lib/assert-never";
import { compareDecimalStrings, isDecimalString } from "@/lib/decimal";
import { formatPercent, formatRate } from "@/lib/format";

// Today's state for one entity. `listed` is false when it is archived or
// has no rate; inactive ones are still listed (they have a current rate).
export type CurrentRate =
  | { listed: false }
  | { listed: true; buy: string; sell: string }
  | { listed: true; rate: string };

export type SnapshotRowStatus = {
  key: string; // currencyId / bankId
  label: string; // "USD", "Wema"
  value: string; // as on the board: "1,360 / 1,374", "3.3%"
  now: string | null; // "Now 1,365 / 1,378" when it changed
  gone: boolean; // "No longer listed"
};

const same = (a: string, b: string) =>
  isDecimalString(a) && isDecimalString(b)
    ? compareDecimalStrings(a, b) === 0
    : a === b;

export function compareSnapshotToCurrent(
  snapshot: BoardSnapshot,
  current: ReadonlyMap<string, CurrentRate>,
): SnapshotRowStatus[] {
  switch (snapshot.type) {
    case "FOREX":
      return snapshot.rows.map((row) => {
        const today = current.get(row.currencyId);
        const base = {
          key: row.currencyId,
          label: row.code,
          value: `${formatRate(row.buy)} / ${formatRate(row.sell)}`,
        };
        if (!today?.listed || !("buy" in today))
          return { ...base, now: null, gone: true };
        const changed =
          !same(row.buy, today.buy) || !same(row.sell, today.sell);
        return {
          ...base,
          now: changed
            ? `Now ${formatRate(today.buy)} / ${formatRate(today.sell)}`
            : null,
          gone: false,
        };
      });
    case "POF":
      return snapshot.rows.map((row) => {
        const today = current.get(row.bankId);
        const base = {
          key: row.bankId,
          label: row.shortName ?? row.name,
          value: formatPercent(row.rate),
        };
        if (!today?.listed || !("rate" in today))
          return { ...base, now: null, gone: true };
        return {
          ...base,
          now: same(row.rate, today.rate)
            ? null
            : `Now ${formatPercent(today.rate)}`,
          gone: false,
        };
      });
    case "CRYPTO":
      return snapshot.rows.map((row) => {
        const today = current.get(row.coinId);
        const base = {
          key: row.coinId,
          label: row.ticker,
          value: `${formatRate(row.buy)} / ${formatRate(row.sell)}`,
        };
        if (!today?.listed || !("buy" in today))
          return { ...base, now: null, gone: true };
        const changed =
          !same(row.buy, today.buy) || !same(row.sell, today.sell);
        return {
          ...base,
          now: changed
            ? `Now ${formatRate(today.buy)} / ${formatRate(today.sell)}`
            : null,
          gone: false,
        };
      });
    case "CUSTOM":
      return snapshot.rows.map((row, i) => ({
        key: String(i),
        label: row.label,
        value: row.value,
        now: null,
        gone: false,
      }));
    default:
      return assertNever(snapshot);
  }
}
