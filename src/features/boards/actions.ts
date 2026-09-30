"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { buildSnapshot, toSnapshotOrg } from "@/features/boards/build-snapshot";
import { diffRates } from "@/features/boards/diff";
import { describeIssues, generateInput } from "@/features/boards/schema";
import type { BoardSnapshot } from "@/features/boards/snapshot";
import { RATE_ERRORS } from "@/features/forex-rates/schema";
import { PERCENT_ERRORS } from "@/features/pof-rates/schema";
import { getTemplate } from "@/features/templates/registry";
import { toDecimalString } from "@/lib/decimal";
import { renderBoardPng } from "@/lib/render/render-board";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { deleteBlob, uploadBoardPng } from "@/lib/server/blob";
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

    // 5. Render. Nothing has been written yet.
    let rendered;
    try {
      rendered = await renderBoardPng(snapshot, template.key);
    } catch (error) {
      console.error("[generateBoard] render failed", error);
      return { ok: false, error: FAILED };
    }

    // 6. Upload. Still nothing written.
    const uploadStarted = performance.now();
    const boardId = randomUUID();
    const imageId = randomUUID();
    const pathname = `boards/${organizationId}/${boardId}/${imageId}.png`;
    let blob;
    try {
      blob = await uploadBoardPng(rendered.png, pathname);
    } catch (error) {
      console.error("[generateBoard] upload failed", error);
      // A timed-out upload may still have landed; the path is ours alone.
      await deleteBlob(pathname);
      return { ok: false, error: FAILED };
    }

    const uploadMs = Math.round(performance.now() - uploadStarted);

    // 7. One transaction: the edited rates (Invariant 2: inserts only),
    // the board with its snapshot, and the image.
    const saveStarted = performance.now();
    try {
      await db.$transaction([
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
        db.rateBoardImage.create({
          data: {
            id: imageId,
            rateBoardId: boardId,
            format: "story",
            width: rendered.width,
            height: rendered.height,
            templateKey: template.key,
            templateVersion: template.version,
            blobUrl: blob.url,
            blobPathname: blob.pathname,
            byteSize: rendered.png.byteLength,
            createdById: userId,
          },
        }),
      ]);
    } catch (error) {
      // 8. Nothing was saved, so the image goes too.
      await deleteBlob(blob.url);
      if (isCheckViolation(error, "forex_sell_gte_buy"))
        return { ok: false, error: RATE_ERRORS.sellBelowBuy };
      if (isCheckViolation(error, "pof_rate_range"))
        return { ok: false, error: PERCENT_ERRORS.range };
      console.error("[generateBoard] transaction failed", error);
      return { ok: false, error: FAILED };
    }

    const saveMs = Math.round(performance.now() - saveStarted);

    // 9–10.
    revalidateBoardPages();
    console.info(
      `[generateBoard] ${template.key}: render ${rendered.ms} ms, upload ${uploadMs} ms, save ${saveMs} ms (${rendered.png.byteLength} bytes, ${prepared.rateInserts.length} rates)`,
    );
    return {
      ok: true,
      data: {
        boardId,
        imageUrl: blob.url,
        savedRates: prepared.rateInserts.length,
        generatedAtLabel: snapshot.content.timeLabel,
        renderMs: rendered.ms,
        snapshot,
      },
    };
  },
);

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
