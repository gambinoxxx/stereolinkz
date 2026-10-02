// History list helpers. Pure and client-safe: boards are read from their
// snapshots (Invariant 5), never from today's rates.
import { z } from "zod";

import {
  type BoardSnapshot,
  boardSnapshotV1,
} from "@/features/boards/snapshot";
import { getTemplate, isTemplateKey } from "@/features/templates/registry";
import { assertNever } from "@/lib/assert-never";
import { formatDayHeading, formatPercent, formatRate } from "@/lib/format";

export const BOARDS_PAGE_SIZE = 20;

// A board as the history list and the dashboard use it. ISO date, parsed
// snapshot (null when it can't be read), image count, newest image.
export type BoardListItem = {
  id: string;
  type: "FOREX" | "POF" | "CRYPTO" | "CUSTOM";
  templateKey: string;
  templateVersion: number;
  createdAt: string;
  snapshot: BoardSnapshot | null;
  imageCount: number;
  latestImageId: string | null;
};

export const historyType = z
  .enum(["FOREX", "POF", "CRYPTO"])
  .optional()
  .catch(undefined);
export type HistoryType = z.infer<typeof historyType>;

// Validated before any render or preview (Invariant 4). Only version 1
// exists; a later version gets its own schema here.
export function readSnapshot(
  snapshotVersion: number,
  json: unknown,
): BoardSnapshot | null {
  if (snapshotVersion !== 1) return null;
  const parsed = boardSnapshotV1.safeParse(json);
  return parsed.success ? parsed.data : null;
}

// ── Cursor ────────────────────────────────────────────────────────────
// "<createdAt ISO>~<id>": the list is ordered by createdAt desc, id desc,
// so two boards made in the same millisecond still have a strict order
// and a page boundary between them never repeats or skips one.

export type BoardCursor = { createdAt: Date; id: string };

export function encodeCursor(board: { createdAt: string; id: string }) {
  return `${board.createdAt}~${board.id}`;
}

const cursorSchema = z
  .string()
  .max(200)
  .regex(/^[^~]+~[^~]+$/)
  .transform((value) => {
    const [at = "", id = ""] = value.split("~");
    return { at, id };
  })
  .pipe(
    z.object({
      at: z.iso.datetime(),
      id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    }),
  );

export function decodeCursor(value: unknown): BoardCursor | null {
  const parsed = cursorSchema.safeParse(value);
  return parsed.success
    ? { createdAt: new Date(parsed.data.at), id: parsed.data.id }
    : null;
}

// ── Display ───────────────────────────────────────────────────────────

export type DayGroup = {
  key: string;
  heading: string;
  boards: BoardListItem[];
};

// Day headings in the org's zone ("Today", "Saturday, 26 September 2026").
// Run on the merged pages, so a day split across two pages gets one heading.
export function groupBoardsByDay(
  boards: BoardListItem[],
  now: Date,
  timeZone: string,
): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const board of boards) {
    const heading = formatDayHeading(new Date(board.createdAt), now, timeZone);
    const last = groups.at(-1);
    if (last && last.heading === heading) last.boards.push(board);
    else
      groups.push({ key: `${heading}:${board.id}`, heading, boards: [board] });
  }
  return groups;
}

// The registry's name, or the key for a template that's gone.
export function templateName(key: string): string {
  return isTemplateKey(key) ? getTemplate(key).name : key;
}

export type RatePill = { label: string; value: string };

// "USD 1,365 / 1,378", "Wema 3.3%": from the snapshot, decimal strings
// formatted without floats.
export function ratePills(snapshot: BoardSnapshot): RatePill[] {
  switch (snapshot.type) {
    case "FOREX":
      return snapshot.rows.map((row) => ({
        label: row.code,
        value: `${formatRate(row.buy)} / ${formatRate(row.sell)}`,
      }));
    case "POF":
      return snapshot.rows.map((row) => ({
        label: row.shortName ?? row.name,
        value: formatPercent(row.rate),
      }));
    case "CRYPTO":
      return snapshot.rows.map((row) => ({
        label: row.ticker,
        value: `${formatRate(row.buy)} / ${formatRate(row.sell)}`,
      }));
    case "CUSTOM":
      return snapshot.rows.map((row) => ({
        label: row.label,
        value: row.value,
      }));
    default:
      return assertNever(snapshot);
  }
}

export const TYPE_LABEL = {
  FOREX: "Forex board",
  POF: "POF board",
  CRYPTO: "Crypto board",
  CUSTOM: "Custom board",
} as const;
