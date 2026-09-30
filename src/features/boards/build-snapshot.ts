// Builds the snapshot a board renders from. Pure: the clock (`now`), the
// org and the rows are passed in, so the same input always gives the same
// snapshot (Invariant 4 applies to what feeds the templates too).
import type { z } from "zod";

import { type BoardType, CONTENT_DEFAULTS } from "@/features/boards/defaults";
import {
  type BoardSnapshot,
  boardSnapshotV1,
} from "@/features/boards/snapshot";
import { formatBoardDate, formatBoardTime } from "@/lib/format";

export type ForexSnapshot = Extract<BoardSnapshot, { type: "FOREX" }>;
export type PofSnapshot = Extract<BoardSnapshot, { type: "POF" }>;
export type ForexRow = ForexSnapshot["rows"][number];
export type PofRow = PofSnapshot["rows"][number];
export type BoardContent = BoardSnapshot["content"];

// The organization fields a snapshot copies.
export type SnapshotOrg = {
  name: string;
  timezone: string;
  quoteCurrency: string;
  logoUrl: string | null;
  backgroundColor: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  contactLine: string | null;
  defaultFinePrint: string | null;
};

// Picks the snapshot's fields from an Organization row (or anything with
// them), so every caller copies the same ones.
export function toSnapshotOrg(org: SnapshotOrg): SnapshotOrg {
  return {
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
}

// What the generator may change; everything else comes from the org.
export type ContentOverrides = Partial<
  Pick<
    BoardContent,
    "headline" | "subheading" | "note" | "reach" | "ctaLabel" | "finePrint"
  >
>;

export class SnapshotError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super(
      `Invalid board snapshot: ${issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
    this.name = "SnapshotError";
  }
}

type BuildInput<T extends BoardType> = {
  org: SnapshotOrg;
  type: T;
  rows: T extends "FOREX" ? ForexRow[] : PofRow[];
  content?: ContentOverrides;
  now: Date;
};

// The snapshot's shape without the Zod check. buildSnapshot validates it;
// the generator's live preview (buildPreviewSnapshot) uses it directly so
// half-typed values can still be shown.
export function assembleSnapshot(
  input: BuildInput<"FOREX"> | BuildInput<"POF">,
): BoardSnapshot {
  const { org, content = {}, now } = input;
  const defaults = CONTENT_DEFAULTS[input.type];

  const shared = {
    headline: content.headline ?? defaults.headline,
    subheading:
      content.subheading !== undefined
        ? content.subheading
        : defaults.subheading,
    note: content.note !== undefined ? content.note : defaults.note,
    reach: content.reach !== undefined ? content.reach : defaults.reach,
    ctaLabel: content.ctaLabel ?? defaults.ctaLabel,
    finePrint:
      content.finePrint !== undefined
        ? content.finePrint
        : (org.defaultFinePrint ?? defaults.finePrint),
    dateLabel: formatBoardDate(now, org.timezone),
    timeLabel: formatBoardTime(now, org.timezone),
    // Copied, so a later logo, colour or number change leaves old boards alone.
    brand: {
      name: org.name,
      logoUrl: org.logoUrl,
      backgroundColor: org.backgroundColor,
      primaryColor: org.primaryColor,
      accentColor: org.accentColor,
      contactLine: org.contactLine,
    },
  };

  return input.type === "FOREX"
    ? {
        v: 1,
        type: "FOREX",
        quoteCurrency: org.quoteCurrency,
        content: shared,
        rows: input.rows,
      }
    : { v: 1, type: "POF", content: shared, rows: input.rows };
}

export function buildSnapshot(input: BuildInput<"FOREX">): ForexSnapshot;
export function buildSnapshot(input: BuildInput<"POF">): PofSnapshot;
export function buildSnapshot(
  input: BuildInput<"FOREX"> | BuildInput<"POF">,
): BoardSnapshot {
  const parsed = boardSnapshotV1.safeParse(assembleSnapshot(input));
  if (!parsed.success) throw new SnapshotError(parsed.error.issues);
  return parsed.data;
}
