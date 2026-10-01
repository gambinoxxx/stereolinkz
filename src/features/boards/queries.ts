import "server-only";

import {
  type SnapshotOrg,
  toSnapshotOrg,
} from "@/features/boards/build-snapshot";
import {
  compareSnapshotToCurrent,
  type CurrentRate,
  type SnapshotRowStatus,
} from "@/features/boards/compare";
import type { BoardType } from "@/features/boards/defaults";
import {
  type BoardCursor,
  type BoardListItem,
  BOARDS_PAGE_SIZE,
  encodeCursor,
  type HistoryType,
  readSnapshot,
  templateName,
} from "@/features/boards/history";
import type { BoardSnapshot } from "@/features/boards/snapshot";
import {
  listTemplates,
  resolveTemplateKey,
} from "@/features/templates/registry";
import type { ThemeName } from "@/features/templates/theme";
import { toDecimalString } from "@/lib/decimal";
import { formatBoardDay } from "@/lib/format";
import { db } from "@/lib/server/db";
import { getUserDisplayName } from "@/lib/server/users";

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

// ── History ───────────────────────────────────────────────────────────

const boardListSelect = {
  id: true,
  type: true,
  templateKey: true,
  templateVersion: true,
  snapshotVersion: true,
  snapshot: true,
  createdAt: true,
  _count: { select: { images: true } },
  images: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true },
  },
} as const;

type BoardListRow = {
  id: string;
  type: BoardListItem["type"];
  templateKey: string;
  templateVersion: number;
  snapshotVersion: number;
  snapshot: unknown;
  createdAt: Date;
  _count: { images: number };
  images: { id: string }[];
};

function toListItem(row: BoardListRow): BoardListItem {
  return {
    id: row.id,
    type: row.type,
    templateKey: row.templateKey,
    templateVersion: row.templateVersion,
    createdAt: row.createdAt.toISOString(),
    snapshot: readSnapshot(row.snapshotVersion, row.snapshot),
    imageCount: row._count.images,
    latestImageId: row.images[0]?.id ?? null,
  };
}

// Newest first, 20 a page, after `cursor` (createdAt desc, id desc).
export async function listBoards(
  organizationId: string,
  { type, cursor }: { type?: HistoryType; cursor?: BoardCursor | null } = {},
): Promise<{ boards: BoardListItem[]; nextCursor: string | null }> {
  const rows = await db.rateBoard.findMany({
    where: {
      organizationId,
      ...(type ? { type } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: BOARDS_PAGE_SIZE + 1, // one extra says whether there's a next page
    select: boardListSelect,
  });
  const boards = rows.slice(0, BOARDS_PAGE_SIZE).map(toListItem);
  const last = boards.at(-1);
  return {
    boards,
    nextCursor:
      rows.length > BOARDS_PAGE_SIZE && last ? encodeCursor(last) : null,
  };
}

export async function countBoards(
  organizationId: string,
  type?: HistoryType,
): Promise<number> {
  return db.rateBoard.count({
    where: { organizationId, ...(type ? { type } : {}) },
  });
}

export async function getOrgTimezone(organizationId: string): Promise<string> {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { timezone: true },
  });
  return org.timezone;
}

export type BoardDetail = BoardListItem & {
  snapshot: BoardSnapshot; // only readable boards open in the detail
  templateName: string;
  generatedBy: string;
  when: string; // "Today at 8:54 AM", "Fri 25 Sept at 11:40 AM"
  rates: SnapshotRowStatus[];
};

// One board for the detail dialog, scoped to the org: another org's id is
// the same as a missing one (null). Rates come from the snapshot; today's
// rates are read only for "Now X", in one query for all the rows.
export async function getBoardDetail(
  organizationId: string,
  boardId: string,
  now: Date,
): Promise<BoardDetail | null> {
  const row = await db.rateBoard.findFirst({
    where: { id: boardId, organizationId },
    select: { ...boardListSelect, createdById: true },
  });
  if (!row) return null;
  const item = toListItem(row);
  const { snapshot } = item;
  if (!snapshot) return null;

  const [current, generatedBy, timezone] = await Promise.all([
    currentRates(organizationId, snapshot),
    getUserDisplayName(row.createdById),
    getOrgTimezone(organizationId),
  ]);

  return {
    ...item,
    snapshot,
    templateName: templateName(row.templateKey),
    generatedBy,
    when: `${formatBoardDay(row.createdAt, now, timezone)} at ${snapshot.content.timeLabel}`,
    rates: compareSnapshotToCurrent(snapshot, current),
  };
}

// Today's newest rate for every currency or bank on the snapshot: one
// findMany over the ids (org-scoped), with each one's newest rate.
// Archived or rate-less entities count as no longer listed; inactive ones
// still have a current rate.
async function currentRates(
  organizationId: string,
  snapshot: BoardSnapshot,
): Promise<Map<string, CurrentRate>> {
  if (snapshot.type === "FOREX") {
    const currencies = await db.currency.findMany({
      where: {
        organizationId,
        id: { in: snapshot.rows.map((r) => r.currencyId) },
      },
      select: {
        id: true,
        status: true,
        rates: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { buy: true, sell: true },
        },
      },
    });
    return new Map(
      currencies.map((c) => {
        const rate = c.rates[0];
        return [
          c.id,
          c.status === "ARCHIVED" || !rate
            ? { listed: false }
            : {
                listed: true,
                buy: toDecimalString(rate.buy),
                sell: toDecimalString(rate.sell),
              },
        ] as const;
      }),
    );
  }
  if (snapshot.type === "POF") {
    const banks = await db.bank.findMany({
      where: { organizationId, id: { in: snapshot.rows.map((r) => r.bankId) } },
      select: {
        id: true,
        status: true,
        pofRates: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { rate: true },
        },
      },
    });
    return new Map(
      banks.map((b) => {
        const rate = b.pofRates[0];
        return [
          b.id,
          b.status === "ARCHIVED" || !rate
            ? { listed: false }
            : { listed: true, rate: toDecimalString(rate.rate) },
        ] as const;
      }),
    );
  }
  return new Map();
}
