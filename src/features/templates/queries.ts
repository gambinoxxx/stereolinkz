import "server-only";

import {
  buildSnapshot,
  type CryptoRow,
  type ForexRow,
  type PofRow,
} from "@/features/boards/build-snapshot";
import { getGeneratorData } from "@/features/boards/queries";
import type { BoardSnapshot } from "@/features/boards/snapshot";
import type { TemplateType } from "@/features/templates/types";
import { assertNever } from "@/lib/assert-never";

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
  const { org, defaultTemplates, currencies, banks, coins, templates } =
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

  const cryptoRows: CryptoRow[] = coins.map((c) => ({
    coinId: c.id,
    ticker: c.ticker,
    name: c.name,
    networks: c.networks.slice(0, 2),
    iconUrl: c.iconUrl,
    badgeColor: c.badgeColor,
    buy: c.buy,
    sell: c.sell,
  }));

  // A live sample per template, or null while the type has no rows yet.
  const sampleFor = (
    template: (typeof templates)[number],
  ): BoardSnapshot | null => {
    const base = { org, now };
    switch (template.type) {
      case "FOREX":
        return forexRows.length === 0
          ? null
          : buildSnapshot({
              ...base,
              type: "FOREX",
              rows: forexRows.slice(0, template.maxRows),
            });
      case "POF":
        return pofRows.length === 0
          ? null
          : buildSnapshot({
              ...base,
              type: "POF",
              rows: pofRows.slice(0, template.maxRows),
            });
      case "CRYPTO":
        return cryptoRows.length === 0
          ? null
          : buildSnapshot({
              ...base,
              type: "CRYPTO",
              rows: cryptoRows.slice(0, template.maxRows),
            });
      default:
        return assertNever(template.type);
    }
  };

  return templates.map((template) => {
    const { type } = template;
    const sample = sampleFor(template);
    return {
      ...template,
      isDefault: defaultTemplates[type] === template.key,
      sample,
    };
  });
}
