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
  GeneratorCurrency,
} from "@/features/boards/queries";
import {
  describeIssues,
  type GenerateInput,
  generateInput,
  type GeneratorErrors,
} from "@/features/boards/schema";
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
  const rows: FormRow[] =
    type === "FOREX"
      ? entities.currencies.map((c, i) => ({
          id: c.id,
          included: i < maxRows,
          buy: formatBoardPrice(c.buy),
          sell: formatBoardPrice(c.sell),
          rate: "",
          note: "",
        }))
      : entities.banks.map((b, i) => ({
          id: b.id,
          included: i < maxRows,
          buy: "",
          sell: "",
          rate: formatBoardPrice(b.rate),
          note: b.note ?? "",
        }));
  return { templateKey, rows, content: defaultContent(type, org) };
}

// USD, or the bank's short name.
export function rowLabels(
  type: BoardType,
  entities: GeneratorEntities,
): Map<string, string> {
  return new Map(
    type === "FOREX"
      ? entities.currencies.map((c) => [c.id, c.code])
      : entities.banks.map((b) => [b.id, b.shortName ?? b.name]),
  );
}

// Fields that differ from the current rate, per row id (the gold state).
export function changedFieldsByRow(
  type: BoardType,
  entities: GeneratorEntities,
  rows: FormRow[],
): Map<string, RateField[]> {
  const result = new Map<string, RateField[]>();
  if (type === "FOREX") {
    const original = new Map(entities.currencies.map((c) => [c.id, c]));
    for (const row of rows) {
      const fields = changedForexFields(original.get(row.id), row);
      if (fields.length > 0) result.set(row.id, fields);
    }
  } else {
    const original = new Map(entities.banks.map((b) => [b.id, b]));
    for (const row of rows) {
      const fields = changedPofFields(original.get(row.id), row);
      if (fields.length > 0) result.set(row.id, fields);
    }
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
  return type === "FOREX"
    ? {
        type,
        templateKey: values.templateKey,
        rows: included.map(({ id, buy, sell }) => ({ id, buy, sell })),
        content: { headline, subheading, note, finePrint },
      }
    : {
        type,
        templateKey: values.templateKey,
        rows: included.map(({ id, rate, note }) => ({ id, rate, note })),
        content: { headline, subheading, finePrint },
      };
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
