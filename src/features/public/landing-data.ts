// The public landing page's data (architecture.md → Invariant 13): public
// Organization fields and, per board type, the newest board's rows read
// from its snapshot. No ids, no createdById, no history. Pure, so the
// mapping is tested with fixtures; the queries are in queries.ts.
import { readSnapshot } from "@/features/boards/history";

export type PublicOrg = {
  name: string;
  logoUrl: string | null;
  backgroundColor: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  contactLine: string | null;
  email: string | null;
  timezone: string;
};

export type PublicForexRow = {
  code: string;
  name: string;
  flagCode: string | null;
  buy: string;
  sell: string;
};

export type PublicCryptoRow = {
  ticker: string;
  name: string;
  networks: string[];
  iconUrl: string | null;
  badgeColor: string | null;
  buy: string;
  sell: string;
};

export type PublicPofRow = {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  rate: string;
  note: string | null;
};

type BoardMeta = {
  dateLabel: string; // "Sun, 27 Sept 2026", from the snapshot
  timeLabel: string; // "10:25 AM"
  createdAt: string; // ISO, for the "Updated today" label
  image: { url: string; width: number; height: number } | null;
};

export type PublicForexBoard = BoardMeta & { rows: PublicForexRow[] };
export type PublicCryptoBoard = BoardMeta & { rows: PublicCryptoRow[] };
export type PublicPofBoard = BoardMeta & { rows: PublicPofRow[] };

export type PublicLanding = {
  org: PublicOrg | null;
  forex: PublicForexBoard | null;
  crypto: PublicCryptoBoard | null;
  pof: PublicPofBoard | null; // also null when PUBLIC_SHOW_POF isn't "true"
};

export type PublicBoardType = "FOREX" | "CRYPTO" | "POF";

// A RateBoard row as queries.ts selects it.
export type RawBoard = {
  id: string;
  snapshot: unknown;
  snapshotVersion: number;
  createdAt: Date;
  images: { blobUrl: string; width: number; height: number }[];
};

function meta(raw: RawBoard, dateLabel: string, timeLabel: string): BoardMeta {
  const image = raw.images[0];
  return {
    dateLabel,
    timeLabel,
    createdAt: raw.createdAt.toISOString(),
    image: image
      ? { url: image.blobUrl, width: image.width, height: image.height }
      : null,
  };
}

// Null when the board can't be read: an unknown snapshot version, a
// snapshot that fails the schema, or one of another type. Logged, so a bad
// board shows up in the logs while the page falls back to its empty state.
function read<T extends PublicBoardType>(type: T, raw: RawBoard) {
  const snapshot = readSnapshot(raw.snapshotVersion, raw.snapshot);
  if (snapshot?.type === type)
    return snapshot as Extract<typeof snapshot, { type: T }>;
  console.error(
    `[public] ${type} board ${raw.id} has an unreadable snapshot (version ${raw.snapshotVersion}); showing the empty state`,
  );
  return null;
}

export function toForexBoard(raw: RawBoard | null): PublicForexBoard | null {
  if (!raw) return null;
  const s = read("FOREX", raw);
  if (!s) return null;
  return {
    ...meta(raw, s.content.dateLabel, s.content.timeLabel),
    rows: s.rows.map(({ code, name, flagCode, buy, sell }) => ({
      code,
      name,
      flagCode,
      buy,
      sell,
    })),
  };
}

export function toCryptoBoard(raw: RawBoard | null): PublicCryptoBoard | null {
  if (!raw) return null;
  const s = read("CRYPTO", raw);
  if (!s) return null;
  return {
    ...meta(raw, s.content.dateLabel, s.content.timeLabel),
    rows: s.rows.map(
      ({ ticker, name, networks, iconUrl, badgeColor, buy, sell }) => ({
        ticker,
        name,
        networks,
        iconUrl,
        badgeColor,
        buy,
        sell,
      }),
    ),
  };
}

export function toPofBoard(raw: RawBoard | null): PublicPofBoard | null {
  if (!raw) return null;
  const s = read("POF", raw);
  if (!s) return null;
  return {
    ...meta(raw, s.content.dateLabel, s.content.timeLabel),
    rows: s.rows.map(({ name, shortName, logoUrl, rate, note }) => ({
      name,
      shortName,
      logoUrl,
      rate,
      note,
    })),
  };
}

// PUBLIC_SHOW_POF must be exactly "true": POF boards name banks, so they
// are shown only when the owner says so.
export function showPof(value: string | undefined): boolean {
  return value?.trim() === "true";
}
