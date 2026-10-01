"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildSnapshot, toSnapshotOrg } from "@/features/boards/build-snapshot";
import { diffRates } from "@/features/boards/diff";
import {
  type BoardListItem,
  decodeCursor,
  historyType,
  readSnapshot,
} from "@/features/boards/history";
import { listBoards } from "@/features/boards/queries";
import { imageRow, renderAndStore } from "@/features/boards/render-and-store";
import { describeIssues, generateInput } from "@/features/boards/schema";
import type { BoardSnapshot } from "@/features/boards/snapshot";
import { RATE_ERRORS } from "@/features/forex-rates/schema";
import { PERCENT_ERRORS } from "@/features/pof-rates/schema";
import { getTemplate, isTemplateKey } from "@/features/templates/registry";
import { toDecimalString } from "@/lib/decimal";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";
import { isCheckViolation } from "@/lib/server/prisma-errors";

export type GeneratedBoard = {
  boardId: string;
  imageUrl: string;
  savedRates: number; // edited rates saved as current
  generatedAtLabel: string; // "10:25 AM", the board's own time
  renderMs: number;
  snapshot: BoardSnapshot; // what was saved; the preview shows it afterwards
};

const FAILED =
  "The image couldn't be generated. Your rates were not changed. Try again.";
const GONE =
  "A rate on this board is no longer available. Refresh the page and try again.";
const inactive = (name: string) =>
  `${name} is no longer active. Refresh the page and try again.`;

type Prepared =
  | { ok: false; error: string }
  | {
      ok: true;
      snapshotRows: BoardSnapshot["rows"];
      rateInserts: ReturnType<
        typeof db.forexRate.create | typeof db.pofRate.create
      >[];
    };

// Pages that show rates or boards.
function revalidateBoardPages() {
  for (const path of [
    "/admin",
    "/admin/forex",
    "/admin/pof",
    "/admin/banks",
    "/admin/history",
    "/admin/generator",
  ])
    revalidatePath(path);
}

// architecture.md → Generate flow. The client sends ids, values and text;
// names, flags, logos, brand and status come from the database, and the
// board is stamped with server time. Nothing is written until the PNG is
// rendered and uploaded; then the edited rates, the board and its image
// are inserted in one transaction (all or nothing).
const generate = safeAction(
  async (
    { organizationId, userId },
    raw: unknown,
  ): Promise<ActionResult<GeneratedBoard>> => {
    // 1. Validate.
    const parsed = generateInput.safeParse(raw);
    if (!parsed.success) {
      const rows = (raw as { rows?: { id?: unknown }[] } | null)?.rows;
      const input = {
        rows: Array.isArray(rows)
          ? rows.map((row) => ({ id: String(row?.id ?? "") }))
          : [],
      };
      const labels = await rowLabels(
        organizationId,
        input.rows.map((row) => row.id),
      );
      const { first, fieldErrors } = describeIssues(
        parsed.error.issues,
        input,
        (id) => labels.get(id) ?? "A rate",
      );
      return {
        ok: false,
        error: first ?? "Check the board and try again.",
        fieldErrors,
      };
    }
    const input = parsed.data;
    const template = getTemplate(input.templateKey); // checked by the schema

    // 2–3. Load the rows from the database, scoped to the org, check they
    // may still appear on a board, and diff against the newest rates.
    const org = await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const prepared =
      input.type === "FOREX"
        ? await prepareForex(organizationId, userId, input.rows)
        : await preparePof(organizationId, userId, input.rows);
    if (!prepared.ok) return prepared;

    // 4. Snapshot, stamped with server time (Invariant 11: org time zone).
    const snapshot =
      input.type === "FOREX"
        ? buildSnapshot({
            org: toSnapshotOrg(org),
            type: "FOREX",
            rows: prepared.snapshotRows as Extract<
              BoardSnapshot,
              { type: "FOREX" }
            >["rows"],
            content: input.content,
            now: new Date(),
          })
        : buildSnapshot({
            org: toSnapshotOrg(org),
            type: "POF",
            rows: prepared.snapshotRows as Extract<
              BoardSnapshot,
              { type: "POF" }
            >["rows"],
            content: input.content,
            now: new Date(),
          });

    // 5–8. Render, upload, then one transaction: the edited rates
    // (Invariant 2: inserts only), the board with its snapshot, and the
    // image. Nothing is written until the PNG is stored, and a failed
    // transaction removes it again (renderAndStore).
    const boardId = randomUUID();
    const stored = await renderAndStore({
      snapshot,
      template,
      organizationId,
      boardId,
      writes: (image) => [
        ...prepared.rateInserts,
        db.rateBoard.create({
          data: {
            id: boardId,
            organizationId,
            type: input.type,
            templateKey: template.key,
            templateVersion: template.version,
            snapshot,
            snapshotVersion: 1,
            createdById: userId,
          },
        }),
        imageRow(image, boardId, template, userId),
      ],
    });
    if (!stored.ok) {
      if (isCheckViolation(stored.error, "forex_sell_gte_buy"))
        return { ok: false, error: RATE_ERRORS.sellBelowBuy };
      if (isCheckViolation(stored.error, "pof_rate_range"))
        return { ok: false, error: PERCENT_ERRORS.range };
      console.error(`[generateBoard] ${stored.stage} failed`, stored.error);
      return { ok: false, error: FAILED };
    }

    // 9–10.
    revalidateBoardPages();
    const { renderMs, uploadMs, saveMs } = stored.timings;
    console.info(
      `[generateBoard] ${template.key}: render ${renderMs} ms, upload ${uploadMs} ms, save ${saveMs} ms (${stored.image.byteSize} bytes, ${prepared.rateInserts.length} rates)`,
    );
    return {
      ok: true,
      data: {
        boardId,
        imageUrl: stored.image.url,
        savedRates: prepared.rateInserts.length,
        generatedAtLabel: snapshot.content.timeLabel,
        renderMs,
        snapshot,
      },
    };
  },
);

// Regenerate (history-regenerate.html): the stored snapshot, exactly as it
// is, drawn again with a template of the same type. Only a RateBoardImage
// is added: the RateBoard row, its templateKey and snapshot stay as they
// were (Invariant 3), no rates are written, and the original image stays.
// The download route serves the newest image.
const regenerateInput = z.object({
  boardId: z.string().min(1).max(64),
  templateKey: z.string().min(1).max(100),
});

const REGENERATE_FAILED = "The image couldn't be generated. Try again.";

const regenerate = safeAction(
  async (
    { organizationId, userId },
    raw: unknown,
  ): Promise<
    ActionResult<{ imageId: string; imageUrl: string; renderMs: number }>
  > => {
    const parsed = regenerateInput.safeParse(raw);
    if (!parsed.success)
      return { ok: false, error: "That board couldn't be found." };
    const { boardId, templateKey } = parsed.data;

    const board = await db.rateBoard.findFirst({
      where: { id: boardId, organizationId },
      select: { id: true, type: true, snapshot: true, snapshotVersion: true },
    });
    if (!board) return { ok: false, error: "That board couldn't be found." };

    // Validated before rendering (Invariant 4).
    const snapshot = readSnapshot(board.snapshotVersion, board.snapshot);
    if (!snapshot)
      return { ok: false, error: "This board can't be regenerated." };
    if (
      board.type === "CUSTOM" ||
      snapshot.type !== board.type ||
      !isTemplateKey(templateKey, board.type)
    )
      return {
        ok: false,
        error:
          "That template isn't available for this board. Pick another one.",
      };
    const template = getTemplate(templateKey);

    // No buildSnapshot, no clock, no current rates or brand: the snapshot
    // as stored. Its logo URLs still work because blobs are never replaced.
    const stored = await renderAndStore({
      snapshot,
      template,
      organizationId,
      boardId: board.id,
      writes: (image) => [imageRow(image, board.id, template, userId)],
    });
    if (!stored.ok) {
      console.error(`[regenerateBoard] ${stored.stage} failed`, stored.error);
      return { ok: false, error: REGENERATE_FAILED };
    }

    revalidatePath("/admin/history");
    const { renderMs, uploadMs, saveMs } = stored.timings;
    console.info(
      `[regenerateBoard] ${template.key}: render ${renderMs} ms, upload ${uploadMs} ms, save ${saveMs} ms (${stored.image.byteSize} bytes)`,
    );
    return {
      ok: true,
      data: {
        imageId: stored.image.imageId,
        imageUrl: stored.image.url,
        renderMs,
      },
    };
  },
);

export async function regenerateBoard(input: {
  boardId: string;
  templateKey: string;
}) {
  return regenerate(input);
}

async function prepareForex(
  organizationId: string,
  userId: string,
  rows: { id: string; buy: string; sell: string }[],
): Promise<Prepared> {
  const currencies = await db.currency.findMany({
    where: { organizationId, id: { in: rows.map((row) => row.id) } },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      flagCode: true,
      status: true,
      rates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { buy: true, sell: true },
      },
    },
  });
  if (currencies.length !== rows.length) return { ok: false, error: GONE };
  const stale = currencies.find((c) => c.status !== "ACTIVE");
  if (stale) return { ok: false, error: inactive(stale.code) };

  const submitted = new Map(rows.map((row) => [row.id, row]));
  const current = new Map(
    currencies.flatMap((c) =>
      c.rates[0]
        ? [
            [
              c.id,
              {
                buy: toDecimalString(c.rates[0].buy),
                sell: toDecimalString(c.rates[0].sell),
              },
            ] as const,
          ]
        : [],
    ),
  );
  const changed = diffRates("FOREX", current, rows);

  return {
    ok: true,
    // In sortOrder, with the submitted values.
    snapshotRows: currencies.map((c) => ({
      currencyId: c.id,
      code: c.code,
      name: c.name,
      flagCode: c.flagCode,
      buy: submitted.get(c.id)!.buy,
      sell: submitted.get(c.id)!.sell,
    })),
    rateInserts: changed.map(({ id }) =>
      db.forexRate.create({
        data: {
          currencyId: id,
          buy: submitted.get(id)!.buy,
          sell: submitted.get(id)!.sell,
          createdById: userId,
        },
      }),
    ),
  };
}

async function preparePof(
  organizationId: string,
  userId: string,
  rows: { id: string; rate: string; note: string | null }[],
): Promise<Prepared> {
  const banks = await db.bank.findMany({
    where: { organizationId, id: { in: rows.map((row) => row.id) } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      shortName: true,
      logoUrl: true,
      status: true,
      pofActive: true,
      pofRates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { rate: true, note: true },
      },
    },
  });
  if (banks.length !== rows.length) return { ok: false, error: GONE };
  const stale = banks.find((b) => b.status !== "ACTIVE" || !b.pofActive);
  if (stale)
    return { ok: false, error: inactive(stale.shortName ?? stale.name) };

  const submitted = new Map(rows.map((row) => [row.id, row]));
  const current = new Map(
    banks.flatMap((b) =>
      b.pofRates[0]
        ? [
            [
              b.id,
              {
                rate: toDecimalString(b.pofRates[0].rate),
                note: b.pofRates[0].note,
              },
            ] as const,
          ]
        : [],
    ),
  );
  const changed = diffRates("POF", current, rows);

  return {
    ok: true,
    snapshotRows: banks.map((b) => ({
      bankId: b.id,
      name: b.name,
      shortName: b.shortName,
      logoUrl: b.logoUrl,
      rate: submitted.get(b.id)!.rate,
      note: submitted.get(b.id)!.note,
    })),
    rateInserts: changed.map(({ id }) =>
      db.pofRate.create({
        data: {
          bankId: id,
          rate: submitted.get(id)!.rate,
          note: submitted.get(id)!.note,
          createdById: userId,
        },
      }),
    ),
  };
}

// For validation messages ("USD: …"): codes or bank short names, org-scoped.
async function rowLabels(
  organizationId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const clean = ids.filter(Boolean);
  if (clean.length === 0) return new Map();
  const [currencies, banks] = await Promise.all([
    db.currency.findMany({
      where: { organizationId, id: { in: clean } },
      select: { id: true, code: true },
    }),
    db.bank.findMany({
      where: { organizationId, id: { in: clean } },
      select: { id: true, name: true, shortName: true },
    }),
  ]);
  return new Map([
    ...currencies.map((c) => [c.id, c.code] as const),
    ...banks.map((b) => [b.id, b.shortName ?? b.name] as const),
  ]);
}

// A "use server" file may only export async functions.
export async function generateBoard(input: unknown) {
  return generate(input);
}

// History "Load more": the next page after a cursor, org-scoped.
const loadMore = safeAction(
  async (
    { organizationId },
    rawType: unknown,
    rawCursor: unknown,
  ): Promise<
    ActionResult<{ boards: BoardListItem[]; nextCursor: string | null }>
  > => {
    const cursor = decodeCursor(rawCursor);
    if (!cursor)
      return {
        ok: false,
        error: "Couldn't load more boards. Refresh the page.",
      };
    const page = await listBoards(organizationId, {
      type: historyType.parse(rawType),
      cursor,
    });
    return { ok: true, data: page };
  },
);

export async function loadMoreBoards(type: unknown, cursor: unknown) {
  return loadMore(type, cursor);
}
