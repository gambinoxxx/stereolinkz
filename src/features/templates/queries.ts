import "server-only";

import {
  buildSnapshot,
  type ForexRow,
  type PofRow,
  type SnapshotOrg,
} from "@/features/boards/build-snapshot";
import type { BoardSnapshot } from "@/features/boards/snapshot";
import {
  listTemplates,
  resolveTemplateKey,
} from "@/features/templates/registry";
import type { TemplateType } from "@/features/templates/types";
import { toDecimalString } from "@/lib/decimal";
import { db } from "@/lib/server/db";

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
// from the org and its current active rows (up to the template's maxRows).
// `now` is the request time; templates themselves never read the clock.
export async function getTemplateSamples(
  organizationId: string,
  now: Date,
): Promise<TemplateCard[]> {
  const [org, currencies, banks] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    db.currency.findMany({
      where: { organizationId, status: "ACTIVE", rates: { some: {} } },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        flagCode: true,
        rates: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { buy: true, sell: true },
        },
      },
    }),
    db.bank.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        pofActive: true,
        pofRates: { some: {} },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        shortName: true,
        logoUrl: true,
        pofRates: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { rate: true, note: true },
        },
      },
    }),
  ]);

  const snapshotOrg: SnapshotOrg = {
    name: org.name,
    timezone: org.timezone,
    quoteCurrency: org.quoteCurrency,
    logoUrl: org.logoUrl,
    backgroundColor: org.backgroundColor,
    primaryColor: org.primaryColor,
    accentColor: org.accentColor,
    contactLine: org.contactLine,
    defaultFinePrint: org.defaultFinePrint,
  };

  const forexRows: ForexRow[] = currencies.flatMap((c) => {
    const rate = c.rates[0];
    return rate
      ? [
          {
            currencyId: c.id,
            code: c.code,
            name: c.name,
            flagCode: c.flagCode,
            buy: toDecimalString(rate.buy),
            sell: toDecimalString(rate.sell),
          },
        ]
      : [];
  });
  const pofRows: PofRow[] = banks.flatMap((b) => {
    const rate = b.pofRates[0];
    return rate
      ? [
          {
            bankId: b.id,
            name: b.name,
            shortName: b.shortName,
            logoUrl: b.logoUrl,
            rate: toDecimalString(rate.rate),
            note: rate.note,
          },
        ]
      : [];
  });

  const defaults = {
    FOREX: resolveTemplateKey("FOREX", org),
    POF: resolveTemplateKey("POF", org),
  };

  return (["FOREX", "POF"] as const).flatMap((type) =>
    listTemplates(type).map((template) => {
      const rows = (type === "FOREX" ? forexRows : pofRows).slice(
        0,
        template.maxRows,
      );
      const sample =
        rows.length === 0
          ? null
          : type === "FOREX"
            ? buildSnapshot({
                org: snapshotOrg,
                type,
                rows: rows as ForexRow[],
                now,
              })
            : buildSnapshot({
                org: snapshotOrg,
                type,
                rows: rows as PofRow[],
                now,
              });
      return {
        key: template.key,
        type,
        name: template.name,
        description: template.description,
        maxRows: template.maxRows,
        version: template.version,
        isDefault: defaults[type] === template.key,
        sample,
      };
    }),
  );
}
