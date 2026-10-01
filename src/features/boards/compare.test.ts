import { describe, expect, it } from "vitest";

import {
  compareSnapshotToCurrent,
  type CurrentRate,
} from "@/features/boards/compare";
import { forexFixture, pofFixture } from "@/test/board-fixtures";

describe("compareSnapshotToCurrent", () => {
  const forex = forexFixture(); // USD 1365/1378, GBP 1815/1840, EUR 1560/1583
  const ids = forex.type === "FOREX" ? forex.rows.map((r) => r.currencyId) : [];

  it("shows no Now when values are equal, including 1365 vs 1365.0000", () => {
    const current = new Map<string, CurrentRate>([
      [ids[0]!, { listed: true, buy: "1365.0000", sell: "1378.0000" }],
    ]);
    expect(compareSnapshotToCurrent(forex, current)[0]).toMatchObject({
      label: "USD",
      value: "1,365 / 1,378",
      now: null,
      gone: false,
    });
  });

  it("shows Now with both values when only sell changed", () => {
    const current = new Map<string, CurrentRate>([
      [ids[0]!, { listed: true, buy: "1365", sell: "1380" }],
    ]);
    expect(compareSnapshotToCurrent(forex, current)[0]?.now).toBe(
      "Now 1,365 / 1,380",
    );
  });

  it("marks a missing or unlisted entity as no longer listed", () => {
    const current = new Map<string, CurrentRate>([
      [ids[1]!, { listed: false }],
    ]);
    const rows = compareSnapshotToCurrent(forex, current);
    expect(rows[0]).toMatchObject({ gone: true, now: null }); // not in the map
    expect(rows[1]).toMatchObject({ gone: true, now: null }); // archived / no rate
  });

  it("compares POF rates as decimals, not notes", () => {
    const pof = pofFixture();
    const bankIds = pof.type === "POF" ? pof.rows.map((r) => r.bankId) : [];
    const current = new Map<string, CurrentRate>([
      [bankIds[0]!, { listed: true, rate: "3.40" }],
      [bankIds[1]!, { listed: true, rate: "3.5" }],
    ]);
    const rows = compareSnapshotToCurrent(pof, current);
    expect(rows[0]).toMatchObject({ label: "Wema", value: "3.4%", now: null });
    expect(rows[1]?.now).toBe("Now 3.5%");
  });
});
