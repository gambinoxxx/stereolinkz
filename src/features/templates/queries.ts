import "server-only";

import {
  buildSnapshot,
  type ForexRow,
  type PofRow,
} from "@/features/boards/build-snapshot";
import { getGeneratorData } from "@/features/boards/queries";
import type { BoardSnapshot } from "@/features/boards/snapshot";
import type { TemplateType } from "@/features/templates/types";

export type TemplateCard = {
  key: string;
  type: TemplateType;
  name: string;
  description: string;
  maxRows: number;
  version: number;
  isDefault: boolean;
  sample: BoardSnapshot | null; // null: no rows yet ("Add a rate to see a preview")
};

// The Templates page: every registered template with a live sample built
// from the org and the rows a new board would show (up to maxRows).
// `now` is the request time; templates themselves never read the clock.
export async function getTemplateSamples(
  organizationId: string,
  now: Date,
): Promise<TemplateCard[]> {
  const { org, defaultTemplates, currencies, banks, templates } =
    await getGeneratorData(organizationId);

  const forexRows: ForexRow[] = currencies.map((c) => ({
    currencyId: c.id,
    code: c.code,
    name: c.name,
    flagCode: c.flagCode,
    buy: c.buy,
    sell: c.sell,
  }));
  const pofRows: PofRow[] = banks.map((b) => ({
    bankId: b.id,
    name: b.name,
    shortName: b.shortName,
    logoUrl: b.logoUrl,
    rate: b.rate,
    note: b.note,
  }));

  return templates.map((template) => {
    const { type } = template;
    const sample =
      type === "FOREX"
        ? forexRows.length === 0
          ? null
          : buildSnapshot({
              org,
              type,
              rows: forexRows.slice(0, template.maxRows),
              now,
            })
        : pofRows.length === 0
          ? null
          : buildSnapshot({
              org,
              type,
              rows: pofRows.slice(0, template.maxRows),
              now,
            });
    return {
      ...template,
      isDefault: defaultTemplates[type] === template.key,
      sample,
    };
  });
}
