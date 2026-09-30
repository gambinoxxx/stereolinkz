import { describe, expect, it } from "vitest";

import { diffRates } from "@/features/boards/diff";

describe("diffRates", () => {
  const forexOriginal = new Map([
    ["usd", { buy: "1365.0000", sell: "1378.0000" }],
    ["gbp", { buy: "1815.0000", sell: "1840.0000" }],
  ]);

  it("compares forex values by number, not text", () => {
    expect(
      diffRates("FOREX", forexOriginal, [
        { id: "usd", buy: "1,365", sell: " 1378.00 " },
        { id: "gbp", buy: "1815", sell: "1840" },
      ]),
    ).toEqual([]);
  });

  it("lists only the changed fields of changed rows", () => {
    expect(
      diffRates("FOREX", forexOriginal, [
        { id: "usd", buy: "1370", sell: "1378" },
        { id: "gbp", buy: "1815", sell: "1850" },
      ]),
    ).toEqual([
      { id: "usd", fields: ["buy"] },
      { id: "gbp", fields: ["sell"] },
    ]);
  });

  it("treats a half-typed value as changed, and a row with no rate as new", () => {
    expect(
      diffRates("FOREX", forexOriginal, [
        { id: "usd", buy: "13.", sell: "1378" },
        { id: "eur", buy: "1560", sell: "1583" },
      ]),
    ).toEqual([
      { id: "usd", fields: ["buy"] },
      { id: "eur", fields: ["buy", "sell"] },
    ]);
  });

  it("compares POF rates by number and notes trimmed, empty = none", () => {
    const original = new Map([
      ["wema", { rate: "3.40", note: null }],
      ["providus", { rate: "3.40", note: "New account" }],
    ]);
    expect(
      diffRates("POF", original, [
        { id: "wema", rate: "3.4%", note: " " },
        { id: "providus", rate: "3.4", note: " New account " },
      ]),
    ).toEqual([]);
    expect(
      diffRates("POF", original, [
        { id: "wema", rate: "3.5", note: null },
        { id: "providus", rate: "3.4", note: "Existing account" },
      ]),
    ).toEqual([
      { id: "wema", fields: ["rate"] },
      { id: "providus", fields: ["note"] },
    ]);
  });
});
