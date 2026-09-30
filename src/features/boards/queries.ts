import "server-only";

import {
  type SnapshotOrg,
  toSnapshotOrg,
} from "@/features/boards/build-snapshot";
import type { BoardType } from "@/features/boards/defaults";
import {
  listTemplates,
  resolveTemplateKey,
} from "@/features/templates/registry";
import type { ThemeName } from "@/features/templates/theme";
import { toDecimalString } from "@/lib/decimal";
import { db } from "@/lib/server/db";

// What a new board can show: active currencies with a rate, and active
// banks with pofActive and a rate, in sortOrder. Values are decimal
// strings (Invariant 10); everything is a plain object for the client.
export type GeneratorCurrency = {
  id: string;
  code: string;
  name: string;
  flagCode: string | null;
  buy: string;
  sell: string;
};

export type GeneratorBank = {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  logoUrl: string | null;
  rate: string;
  note: string | null;
};

export type GeneratorTemplate = {
  key: string;
  type: BoardType;
  name: string;
  description: string;
  maxRows: number;
  version: number;
  theme: ThemeName;
};

export type GeneratorData = {
  org: SnapshotOrg;
  defaultTemplates: Record<BoardType, string>;
  currencies: GeneratorCurrency[];
  banks: GeneratorBank[];
  templates: GeneratorTemplate[];
};

export async function getGeneratorData(
  organizationId: string,
): Promise<GeneratorData> {
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
        slug: true,
        logoUrl: true,
        pofRates: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { rate: true, note: true },
        },
      },
    }),
  ]);

  return {
    org: toSnapshotOrg(org),
    defaultTemplates: {
      FOREX: resolveTemplateKey("FOREX", org),
      POF: resolveTemplateKey("POF", org),
    },
    currencies: currencies.flatMap(({ rates, ...c }) =>
      rates[0]
        ? [
            {
              ...c,
              buy: toDecimalString(rates[0].buy),
              sell: toDecimalString(rates[0].sell),
            },
          ]
        : [],
    ),
    banks: banks.flatMap(({ pofRates, ...b }) =>
      pofRates[0]
        ? [
            {
              ...b,
              rate: toDecimalString(pofRates[0].rate),
              note: pofRates[0].note,
            },
          ]
        : [],
    ),
    templates: (["FOREX", "POF"] as const).flatMap((type) =>
      listTemplates(type).map((t) => ({
        key: t.key,
        type,
        name: t.name,
        description: t.description,
        maxRows: t.maxRows,
        version: t.version,
        theme: t.theme,
      })),
    ),
  };
}
