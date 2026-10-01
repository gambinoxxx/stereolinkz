// "Use these rates again": a saved board's snapshot mapped onto today's
// generator rows. Pure.
//
// Rows are today's (active, in today's sortOrder), matched to the snapshot
// by currencyId / bankId:
//   - in the snapshot → ticked, with the snapshot's value in the input;
//     today's value stays the original, so a different value shows gold
//     and is saved as current when generated
//   - not in the snapshot → present, unticked
//   - in the snapshot but no longer active or gone → skipped, named in a
//     notice
// Content (headline, subheading, note, small print) comes from the
// snapshot. Date, time and brand don't: a new board gets server time and
// today's brand.
import type { BoardType } from "@/features/boards/defaults";
import type {
  FormRow,
  GeneratorFormValues,
} from "@/features/boards/generator-form";
import type { GeneratorData } from "@/features/boards/queries";
import type { BoardSnapshot } from "@/features/boards/snapshot";
import { isTemplateKey } from "@/features/templates/registry";
import { formatBoardPrice } from "@/lib/format";

export type Prefill = {
  type: BoardType;
  values: GeneratorFormValues;
  skippedNotice: string | null; // "Skipped 1 item that is no longer active: CAD."
};

type PrefillData = Pick<
  GeneratorData,
  "currencies" | "banks" | "defaultTemplates"
>;

export function prefillFromSnapshot(
  snapshot: BoardSnapshot,
  boardTemplateKey: string,
  data: PrefillData,
): Prefill | null {
  if (snapshot.type === "CUSTOM") return null;
  const type = snapshot.type;
  const templateKey = isTemplateKey(boardTemplateKey, type)
    ? boardTemplateKey
    : data.defaultTemplates[type];

  let rows: FormRow[];
  let skipped: string[];
  if (snapshot.type === "FOREX") {
    const saved = new Map(snapshot.rows.map((r) => [r.currencyId, r]));
    const today = new Set(data.currencies.map((c) => c.id));
    rows = data.currencies.map((c) => {
      const row = saved.get(c.id);
      return {
        id: c.id,
        included: row !== undefined,
        buy: formatBoardPrice(row?.buy ?? c.buy),
        sell: formatBoardPrice(row?.sell ?? c.sell),
        rate: "",
        note: "",
      };
    });
    skipped = snapshot.rows
      .filter((r) => !today.has(r.currencyId))
      .map((r) => r.code);
  } else {
    const saved = new Map(snapshot.rows.map((r) => [r.bankId, r]));
    const today = new Set(data.banks.map((b) => b.id));
    rows = data.banks.map((b) => {
      const row = saved.get(b.id);
      return {
        id: b.id,
        included: row !== undefined,
        buy: "",
        sell: "",
        rate: formatBoardPrice(row?.rate ?? b.rate),
        note: (row ? row.note : b.note) ?? "",
      };
    });
    skipped = snapshot.rows
      .filter((r) => !today.has(r.bankId))
      .map((r) => r.shortName ?? r.name);
  }

  const { content } = snapshot;
  return {
    type,
    values: {
      templateKey,
      rows,
      content: {
        headline: content.headline,
        subheading: content.subheading ?? "",
        note: content.note ?? "",
        finePrint: content.finePrint ?? "",
      },
    },
    skippedNotice:
      skipped.length === 0
        ? null
        : `Skipped ${skipped.length} ${skipped.length === 1 ? "item that is" : "items that are"} no longer active: ${skipped.join(", ")}.`,
  };
}
