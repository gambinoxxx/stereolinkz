// The generator form's state and how it becomes generateBoard's input.
// Pure and client-safe (no Prisma): the page passes GeneratorData in.
import type { SnapshotOrg } from "@/features/boards/build-snapshot";
import { type BoardType, CONTENT_DEFAULTS } from "@/features/boards/defaults";
import {
  changedForexFields,
  changedPofFields,
  type RateField,
} from "@/features/boards/diff";
import type {
  GeneratorBank,
  GeneratorCoin,
  GeneratorCurrency,
} from "@/features/boards/queries";
import {
  describeIssues,
  type GenerateInput,
  generateInput,
  type GeneratorErrors,
} from "@/features/boards/schema";
import { assertNever } from "@/lib/assert-never";
import { formatBoardPrice } from "@/lib/format";

// One row per currency or bank. Forex rows use buy/sell, POF rows use
// rate/note; the unused pair stays "". A flat shape keeps React Hook
// Form's paths simple across both types.
export type FormRow = {
  id: string;
  included: boolean;
  buy: string;
  sell: string;
  rate: string;
  note: string;
};

export type FormContent = {
  headline: string;
  subheading: string;
  note: string; // forex only
  finePrint: string;
};

export type GeneratorFormValues = {
  templateKey: string;
  rows: FormRow[];
  content: FormContent;
};

// What the rows come from; the originals are what "changed" compares to.
export type GeneratorEntities = {
  currencies: GeneratorCurrency[];
  banks: GeneratorBank[];
  coins: GeneratorCoin[];
};

export function defaultContent(
  type: BoardType,
  org: Pick<SnapshotOrg, "defaultFinePrint">,
): FormContent {
  const d = CONTENT_DEFAULTS[type];
  return {
    headline: d.headline,
    subheading: d.subheading ?? "",
    note: d.note ?? "",
    finePrint: org.defaultFinePrint ?? d.finePrint,
  };
}

// Current values, prefilled. Rows past the template's capacity start
// unticked, so a fresh form can be generated straight away.
export function initialFormValues(
  type: BoardType,
  entities: GeneratorEntities,
  org: Pick<SnapshotOrg, "defaultFinePrint">,
  templateKey: string,
  maxRows: number,
): GeneratorFormValues {
  const pairRow = (
    item: { id: string; buy: string; sell: string },
    i: number,
  ): FormRow => ({
    id: item.id,
    included: i < maxRows,
    buy: formatBoardPrice(item.buy),
    sell: formatBoardPrice(item.sell),
    rate: "",
    note: "",
  });
  let rows: FormRow[];
  switch (type) {
    case "FOREX":
      rows = entities.currencies.map(pairRow);
      break;
    case "CRYPTO":
      rows = entities.coins.map(pairRow);
      break;
    case "POF":
      rows = entities.banks.map((b, i) => ({
        id: b.id,
        included: i < maxRows,
        buy: "",
        sell: "",
        rate: formatBoardPrice(b.rate),
        note: b.note ?? "",
      }));
      break;
    default:
      return assertNever(type);
  }
  return { templateKey, rows, content: defaultContent(type, org) };
}

// USD, or the bank's short name.
export function rowLabels(
  type: BoardType,
  entities: GeneratorEntities,
): Map<string, string> {
  switch (type) {
    case "FOREX":
      return new Map(entities.currencies.map((c) => [c.id, c.code]));
    case "POF":
      return new Map(entities.banks.map((b) => [b.id, b.shortName ?? b.name]));
    case "CRYPTO":
      return new Map(entities.coins.map((c) => [c.id, c.ticker]));
    default:
      return assertNever(type);
  }
}

// Fields that differ from the current rate, per row id (the gold state).
export function changedFieldsByRow(
  type: BoardType,
  entities: GeneratorEntities,
  rows: FormRow[],
): Map<string, RateField[]> {
  const result = new Map<string, RateField[]>();
  const collect = <T>(
    originals: Map<string, T>,
    diff: (original: T | undefined, row: FormRow) => RateField[],
  ) => {
    for (const row of rows) {
      const fields = diff(originals.get(row.id), row);
      if (fields.length > 0) result.set(row.id, fields);
    }
  };
  switch (type) {
    case "FOREX":
      collect(
        new Map(entities.currencies.map((c) => [c.id, c])),
        changedForexFields,
      );
      break;
    case "CRYPTO":
      // Same buy/sell rules as forex.
      collect(
        new Map(entities.coins.map((c) => [c.id, c])),
        changedForexFields,
      );
      break;
    case "POF":
      collect(new Map(entities.banks.map((b) => [b.id, b])), changedPofFields);
      break;
    default:
      return assertNever(type);
  }
  return result;
}

// What generateBoard receives: included rows only, the type's own fields.
export function toGenerateInput(
  type: BoardType,
  values: GeneratorFormValues,
): GenerateInput {
  const included = values.rows.filter((row) => row.included);
  const { headline, subheading, note, finePrint } = values.content;
  const { templateKey } = values;
  switch (type) {
    case "FOREX":
    case "CRYPTO":
      return {
        type,
        templateKey,
        rows: included.map(({ id, buy, sell }) => ({ id, buy, sell })),
        content: { headline, subheading, note, finePrint },
      };
    case "POF":
      return {
        type,
        templateKey,
        rows: included.map(({ id, rate, note }) => ({ id, rate, note })),
        content: { headline, subheading, finePrint },
      };
    default:
      return assertNever(type);
  }
}

// The same check the server runs, for the error line and the disabled
// Generate button.
export function validateGenerator(
  type: BoardType,
  values: GeneratorFormValues,
  labels: Map<string, string>,
): GeneratorErrors {
  const input = toGenerateInput(type, values);
  const parsed = generateInput.safeParse(input);
  if (parsed.success) return { first: null, fieldErrors: {} };
  return describeIssues(
    parsed.error.issues,
    input,
    (id) => labels.get(id) ?? "A rate",
  );
}
