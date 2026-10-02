import { describe, expect, it } from "vitest";

import { mergeRateChanges } from "@/features/dashboard/changes";

const fx = (
  id: string,
  at: string,
  buy: string,
  sell: string,
  prev: [string, string] | null,
) => ({
  id,
  at,
  code: "USD",
  buy,
  sell,
  prevBuy: prev?.[0] ?? null,
  prevSell: prev?.[1] ?? null,
});

describe("mergeRateChanges", () => {
  it("maps from → to with direction, and a first rate as new", () => {
    expect(
      mergeRateChanges(
        [
          fx("f1", "2026-09-27T09:25:00.000Z", "1365.0000", "1378.0000", [
            "1360.0000",
            "1374.0000",
          ]),
        ],
        [],
        [],
        5,
      ),
    ).toEqual([
      {
        id: "f1",
        at: "2026-09-27T09:25:00.000Z",
        label: "USD",
        from: "1,360 / 1,374",
        to: "1,365 / 1,378",
        direction: "up",
      },
    ]);
    expect(
      mergeRateChanges(
        [fx("f2", "2026-09-27T09:00:00.000Z", "1365", "1378", null)],
        [],
        [],
        5,
      )[0],
    ).toMatchObject({
      from: null,
      to: "1,365 / 1,378",
      direction: "flat",
    });
  });

  it("lets sell lead the direction, buy deciding when sell is level", () => {
    const [down, buyUp] = mergeRateChanges(
      [
        fx("a", "2026-09-27T09:02:00.000Z", "1370", "1370", ["1360", "1380"]),
        fx("b", "2026-09-27T09:01:00.000Z", "1370", "1380", ["1360", "1380"]),
      ],
      [],
      [],
      5,
    );
    expect([down?.direction, buyUp?.direction]).toEqual(["down", "up"]);
  });

  it("merges forex, POF and crypto newest first and keeps the limit", () => {
    const changes = mergeRateChanges(
      [
        fx("f-old", "2026-09-27T07:40:00.000Z", "1560", "1583", [
          "1552",
          "1578",
        ]),
        fx("f-new", "2026-09-27T09:25:00.000Z", "1365", "1378", [
          "1360",
          "1374",
        ]),
      ],
      [
        {
          id: "p1",
          at: "2026-09-27T08:10:00.000Z",
          bankLabel: "Wema",
          rate: "3.40",
          prevRate: "3.30",
        },
        {
          id: "p2",
          at: "2026-09-27T06:00:00.000Z",
          bankLabel: "Globus",
          rate: "2.30",
          prevRate: "2.30",
        },
      ],
      [
        {
          id: "c1",
          at: "2026-09-27T08:30:00.000Z",
          ticker: "BTC",
          buy: "1580",
          sell: "1620",
          prevBuy: "1585",
          prevSell: "1625",
        },
      ],
      4,
    );
    expect(
      changes.map((c) => [c.id, c.label, c.from, c.to, c.direction]),
    ).toEqual([
      ["f-new", "USD", "1,360 / 1,374", "1,365 / 1,378", "up"],
      ["c1", "BTC", "1,585 / 1,625", "1,580 / 1,620", "down"],
      ["p1", "Wema POF", "3.3%", "3.4%", "up"],
      ["f-old", "USD", "1,552 / 1,578", "1,560 / 1,583", "up"],
    ]);
  });
});
