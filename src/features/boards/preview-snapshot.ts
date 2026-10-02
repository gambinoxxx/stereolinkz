// The generator's live preview snapshot. Lenient where buildSnapshot is
// strict, and never throws: a value that isn't a number yet shows as "—",
// no ticked rows shows the "Tick at least one rate" card, and text past
// its limit is clipped. Pure; `now` is the browser clock (the server
// stamps its own time when generating).
import {
  assembleSnapshot,
  type SnapshotOrg,
} from "@/features/boards/build-snapshot";
import type { BoardType } from "@/features/boards/defaults";
import type {
  GeneratorEntities,
  GeneratorFormValues,
} from "@/features/boards/generator-form";
import { CONTENT_LIMITS, normaliseHeadline } from "@/features/boards/schema";
import type { BoardSnapshot } from "@/features/boards/snapshot";
import { decimalInput } from "@/features/forex-rates/schema";
import { NOTE_MAX, percentInput } from "@/features/pof-rates/schema";

export const PENDING_VALUE = "—";

function previewValue(
  schema: typeof decimalInput | typeof percentInput,
  value: string,
): string {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : PENDING_VALUE;
}

function clip(value: string, max: number): string | null {
  const text = value.trim().slice(0, max);
  return text === "" ? null : text;
}

export function buildPreviewSnapshot(
  org: SnapshotOrg,
  type: BoardType,
  values: GeneratorFormValues,
  entities: GeneratorEntities,
  now: Date,
): BoardSnapshot {
  const included = values.rows.filter((row) => row.included);
  const { content } = values;
  const headline = normaliseHeadline(content.headline)
    .split("\n")
    .slice(0, CONTENT_LIMITS.headlineLines)
    .join("\n")
    .slice(0, CONTENT_LIMITS.headline);
  const overrides = {
    headline,
    subheading: clip(content.subheading, CONTENT_LIMITS.subheading),
    finePrint: clip(content.finePrint, CONTENT_LIMITS.finePrint),
  };

  if (type === "FOREX") {
    const byId = new Map(entities.currencies.map((c) => [c.id, c]));
    return assembleSnapshot({
      org,
      type,
      now,
      content: {
        ...overrides,
        note: clip(content.note, CONTENT_LIMITS.note),
      },
      rows: included.flatMap((row) => {
        const c = byId.get(row.id);
        return c
          ? [
              {
                currencyId: c.id,
                code: c.code,
                name: c.name,
                flagCode: c.flagCode,
                buy: previewValue(decimalInput, row.buy),
                sell: previewValue(decimalInput, row.sell),
              },
            ]
          : [];
      }),
    });
  }

  if (type === "CRYPTO") {
    const byId = new Map(entities.coins.map((c) => [c.id, c]));
    return assembleSnapshot({
      org,
      type,
      now,
      content: {
        ...overrides,
        note: clip(content.note, CONTENT_LIMITS.note),
      },
      rows: included.flatMap((row) => {
        const c = byId.get(row.id);
        return c
          ? [
              {
                coinId: c.id,
                ticker: c.ticker,
                name: c.name,
                networks: c.networks,
                iconUrl: c.iconUrl,
                badgeColor: c.badgeColor,
                buy: previewValue(decimalInput, row.buy),
                sell: previewValue(decimalInput, row.sell),
              },
            ]
          : [];
      }),
    });
  }

  const byId = new Map(entities.banks.map((b) => [b.id, b]));
  return assembleSnapshot({
    org,
    type,
    now,
    content: overrides,
    rows: included.flatMap((row) => {
      const b = byId.get(row.id);
      return b
        ? [
            {
              bankId: b.id,
              name: b.name,
              shortName: b.shortName,
              logoUrl: b.logoUrl,
              rate: previewValue(percentInput, row.rate),
              note: clip(row.note, NOTE_MAX),
            },
          ]
        : [];
    }),
  });
}
