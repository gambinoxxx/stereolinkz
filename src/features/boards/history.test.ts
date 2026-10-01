import { describe, expect, it } from "vitest";

import {
  type BoardListItem,
  decodeCursor,
  encodeCursor,
  groupBoardsByDay,
  ratePills,
  readSnapshot,
  templateName,
} from "@/features/boards/history";
import { forexFixture, pofFixture } from "@/test/board-fixtures";

const LAGOS = "Africa/Lagos";

const board = (id: string, createdAt: string): BoardListItem => ({
  id,
  type: "FOREX",
  templateKey: "forex/purple-signal",
  templateVersion: 1,
  createdAt,
  snapshot: null,
  imageCount: 1,
  latestImageId: `${id}-img`,
});

describe("cursor", () => {
  it("round-trips createdAt and id", () => {
    const cursor = encodeCursor({
      createdAt: "2026-09-27T09:25:00.123Z",
      id: "b-1",
    });
    expect(decodeCursor(cursor)).toEqual({
      createdAt: new Date("2026-09-27T09:25:00.123Z"),
      id: "b-1",
    });
  });

  it("rejects anything else", () => {
    for (const bad of [
      undefined,
      "",
      "nope",
      "2026-09-27~",
      "x~y",
      "2026-09-27T09:25:00Z~a b",
      42,
    ])
      expect(decodeCursor(bad)).toBeNull();
  });
});

describe("groupBoardsByDay", () => {
  const now = new Date("2026-09-27T10:00:00Z"); // 11:00 Lagos

  it("puts a board made just after midnight Lagos on the new day", () => {
    const groups = groupBoardsByDay(
      [
        board("a", "2026-09-27T09:00:00Z"),
        board("b", "2026-09-26T23:05:00Z"), // 00:05 on the 27th in Lagos
        board("c", "2026-09-26T22:55:00Z"), // 23:55 on the 26th
      ],
      now,
      LAGOS,
    );
    expect(groups.map((g) => [g.heading, g.boards.map((b) => b.id)])).toEqual([
      ["Today", ["a", "b"]],
      ["Saturday, 26 September 2026", ["c"]],
    ]);
  });

  it("gives a day split across two pages one heading", () => {
    const page1 = [board("a", "2026-09-26T12:00:00Z")];
    const page2 = [board("b", "2026-09-26T11:00:00Z")];
    expect(groupBoardsByDay([...page1, ...page2], now, LAGOS)).toHaveLength(1);
  });
});

describe("snapshot display", () => {
  it("reads a valid snapshot and refuses broken or unknown versions", () => {
    expect(readSnapshot(1, forexFixture())?.type).toBe("FOREX");
    expect(readSnapshot(1, { v: 1, type: "FOREX" })).toBeNull();
    expect(readSnapshot(2, forexFixture())).toBeNull();
  });

  it("formats rate pills from the snapshot with thousands separators", () => {
    expect(ratePills(forexFixture())[0]).toEqual({
      label: "USD",
      value: "1,365 / 1,378",
    });
    expect(ratePills(pofFixture())[0]).toEqual({
      label: "Wema",
      value: "3.4%",
    });
  });

  it("names templates from the registry, falling back to the key", () => {
    expect(templateName("forex/daylight")).toBe("Daylight");
    expect(templateName("forex/retired")).toBe("forex/retired");
  });
});
