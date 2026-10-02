import { describe, expect, it } from "vitest";

import { boardSnapshotV1 } from "@/features/boards/snapshot";
import { cryptoFixture, WORST_CASES } from "@/test/board-fixtures";
import real from "@/test/fixtures/real-snapshots.json";

describe("boardSnapshotV1 after adding CRYPTO (additive, version 1)", () => {
  it("still parses real Forex and POF boards unchanged", () => {
    for (const board of [real.forex, real.pof]) {
      const parsed = boardSnapshotV1.safeParse(board.snapshot);
      expect(parsed.success, board.boardId).toBe(true);
      expect(parsed.data).toEqual(board.snapshot);
    }
  });

  it("parses crypto boards, including the worst case", () => {
    expect(boardSnapshotV1.parse(cryptoFixture()).type).toBe("CRYPTO");
    expect(
      boardSnapshotV1.parse(WORST_CASES["crypto-long-names"]()).rows,
    ).toHaveLength(6);
  });

  it("refuses a crypto row with sell below buy, or more than 2 networks", () => {
    const board = cryptoFixture();
    const [row] = board.rows;
    const withRow = (patch: object) => ({
      ...board,
      rows: [{ ...row, ...patch }],
    });
    expect(
      boardSnapshotV1.safeParse(withRow({ buy: "1620", sell: "1580" })).success,
    ).toBe(false);
    expect(
      boardSnapshotV1.safeParse(withRow({ networks: ["A", "B", "C"] })).success,
    ).toBe(false);
  });
});
