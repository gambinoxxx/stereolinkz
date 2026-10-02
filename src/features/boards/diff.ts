// Which submitted rates differ from the current ones. Used by the form
// (the gold "changed" state and "2 edited rates will be saved") and by
// generateBoard (which rows become new ForexRate / PofRate inserts). Pure.
import { normaliseDecimal } from "@/features/forex-rates/schema";
import { normalisePercent } from "@/features/pof-rates/schema";
import { compareDecimalStrings, isDecimalString } from "@/lib/decimal";

export type ForexValues = { buy: string; sell: string };
export type PofValues = { rate: string; note: string | null };
export type RateField = "buy" | "sell" | "rate" | "note";
export type RateDiff = { id: string; fields: RateField[] };

// Equal by value: "1,365" equals "1365.0000". A value that isn't a number
// yet ("13.") never equals a saved rate.
function sameNumber(a: string, b: string, normalise: (v: string) => string) {
  const x = normalise(a);
  const y = normalise(b);
  if (isDecimalString(x) && isDecimalString(y))
    return compareDecimalStrings(x, y) === 0;
  return x === y;
}

// Compared trimmed; an empty note is no note.
function sameNote(a: string | null, b: string | null) {
  return (a ?? "").trim() === (b ?? "").trim();
}

export function changedForexFields(
  original: ForexValues | undefined,
  value: ForexValues,
): RateField[] {
  if (!original) return ["buy", "sell"];
  const fields: RateField[] = [];
  if (!sameNumber(value.buy, original.buy, normaliseDecimal))
    fields.push("buy");
  if (!sameNumber(value.sell, original.sell, normaliseDecimal))
    fields.push("sell");
  return fields;
}

export function changedPofFields(
  original: PofValues | undefined,
  value: PofValues,
): RateField[] {
  if (!original) return ["rate", "note"];
  const fields: RateField[] = [];
  if (!sameNumber(value.rate, original.rate, normalisePercent))
    fields.push("rate");
  if (!sameNote(value.note, original.note)) fields.push("note");
  return fields;
}

type Submitted<V> = V & { id: string };

// Only the rows with at least one changed field, in submitted order. A row
// with no current rate (`original` has no entry) counts as changed.
export function diffRates(
  type: "FOREX" | "CRYPTO", // coins use the forex buy/sell rules
  original: ReadonlyMap<string, ForexValues>,
  submitted: Submitted<ForexValues>[],
): RateDiff[];
export function diffRates(
  type: "POF",
  original: ReadonlyMap<string, PofValues>,
  submitted: Submitted<PofValues>[],
): RateDiff[];
export function diffRates(
  type: "FOREX" | "POF" | "CRYPTO",
  original: ReadonlyMap<string, ForexValues | PofValues>,
  submitted: Submitted<ForexValues | PofValues>[],
): RateDiff[] {
  return submitted.flatMap((row) => {
    const fields =
      type !== "POF"
        ? changedForexFields(
            original.get(row.id) as ForexValues | undefined,
            row as ForexValues,
          )
        : changedPofFields(
            original.get(row.id) as PofValues | undefined,
            row as PofValues,
          );
    return fields.length > 0 ? [{ id: row.id, fields }] : [];
  });
}
