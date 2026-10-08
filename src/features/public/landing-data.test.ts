import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type RawBoard,
  showPof,
  toCryptoBoard,
  toForexBoard,
  toPofBoard,
} from "@/features/public/landing-data";
import { cryptoFixture, forexFixture, pofFixture } from "@/test/board-fixtures";
import real from "@/test/fixtures/real-snapshots.json";

const raw = (snapshot: unknown, over: Partial<RawBoard> = {}): RawBoard => ({
  id: "board-1",
  snapshot,
  snapshotVersion: 1,
  createdAt: new Date("2026-09-27T09:25:00Z"),
  images: [
    {
      blobUrl: "https://x.public.blob.vercel-storage.com/boards/o/b/i.png",
      width: 1080,
      height: 1920,
    },
  ],
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("toForexBoard", () => {
  it("returns the rows, labels and newest image", () => {
    const fx = forexFixture();
    const board = toForexBoard(raw(fx));
    expect(board).toEqual({
      dateLabel: fx.content.dateLabel,
      timeLabel: fx.content.timeLabel,
      createdAt: "2026-09-27T09:25:00.000Z",
      image: {
        url: "https://x.public.blob.vercel-storage.com/boards/o/b/i.png",
        width: 1080,
        height: 1920,
      },
      rows: fx.rows.map(({ code, name, flagCode, buy, sell }) => ({
        code,
        name,
        flagCode,
        buy,
        sell,
      })),
    });
  });

  it("never passes ids or the brand on to the browser", () => {
    const text = JSON.stringify(toForexBoard(raw(forexFixture())));
    expect(text).not.toContain("currencyId");
    expect(text).not.toContain("fixture-");
    expect(text).not.toContain("contactLine");
  });

  it("reads a real board saved in Phase 7", () => {
    const board = toForexBoard(raw(real.forex.snapshot));
    expect(board?.rows.length).toBeGreaterThan(0);
  });

  it("has no image when the board has none", () => {
    expect(toForexBoard(raw(forexFixture(), { images: [] }))?.image).toBeNull();
  });

  it("is null when there is no board", () => {
    expect(toForexBoard(null)).toBeNull();
  });

  it("is null, and logs, for an unreadable snapshot", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toForexBoard(raw({ v: 1, type: "FOREX", rows: [] }))).toBeNull();
    expect(
      toForexBoard(raw(forexFixture(), { snapshotVersion: 2 })),
    ).toBeNull();
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0]?.[0]).toContain("board-1");
  });

  it("is null for a snapshot of another type", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toForexBoard(raw(pofFixture()))).toBeNull();
  });
});

describe("toCryptoBoard", () => {
  it("returns coins with their networks and badge colours", () => {
    const c = cryptoFixture();
    const board = toCryptoBoard(raw(c));
    expect(board?.rows).toEqual(
      c.rows.map(
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
    );
    expect(JSON.stringify(board)).not.toContain("coinId");
  });
});

describe("toPofBoard", () => {
  it("returns banks and rates, without bank ids", () => {
    const board = toPofBoard(raw(real.pof.snapshot));
    expect(board?.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(board)).not.toContain("bankId");
    expect(board?.rows[0]).toEqual(
      expect.objectContaining({ rate: expect.any(String) }),
    );
  });
});

describe("showPof", () => {
  it("is on only for exactly true", () => {
    expect(showPof("true")).toBe(true);
    expect(showPof(" true ")).toBe(true);
    expect(showPof("false")).toBe(false);
    expect(showPof("yes")).toBe(false);
    expect(showPof(undefined)).toBe(false);
  });
});
