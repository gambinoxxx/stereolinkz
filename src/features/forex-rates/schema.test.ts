import { describe, expect, it } from "vitest";

import {
  decimalInput,
  forexRateInput,
  RATE_ERRORS,
} from "@/features/forex-rates/schema";

function issues(buy: string, sell: string) {
  const result = forexRateInput.safeParse({ currencyId: "c1", buy, sell });
  return result.success
    ? []
    : result.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`);
}

describe("decimalInput", () => {
  it("strips spaces and thousands commas", () => {
    expect(decimalInput.parse("1,365")).toBe("1365");
    expect(decimalInput.parse(" 1 365.50 ")).toBe("1365.50");
  });

  it("accepts up to 4 decimal places and rejects 5", () => {
    expect(decimalInput.parse("1365.1234")).toBe("1365.1234");
    expect(decimalInput.safeParse("1365.12345").success).toBe(false);
  });

  it("rejects text, negatives and empty input", () => {
    for (const bad of ["abc", "-5", "", "1.2.3", "12e3"]) {
      expect(decimalInput.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe("forexRateInput", () => {
  it("accepts sell above buy, and sell equal to buy", () => {
    expect(issues("1365", "1378")).toEqual([]);
    expect(issues("1365", "1,365.0000")).toEqual([]);
  });

  it("rejects zero and negatives", () => {
    expect(issues("0", "1378")).toEqual([`buy: ${RATE_ERRORS.buyPositive}`]);
    expect(issues("1365", "0.0000")).toEqual([
      `sell: ${RATE_ERRORS.sellPositive}`,
    ]);
    expect(issues("-1", "1378")).toEqual([
      "buy: Enter a number with up to 4 decimal places.",
    ]);
  });

  it("rejects sell below buy, comparing as decimals", () => {
    expect(issues("1378", "1365")).toEqual([
      `sell: ${RATE_ERRORS.sellBelowBuy}`,
    ]);
    // "9.9" < "10" as numbers, though not as text.
    expect(issues("10", "9.9")).toEqual([`sell: ${RATE_ERRORS.sellBelowBuy}`]);
  });

  it("returns normalised strings", () => {
    expect(
      forexRateInput.parse({ currencyId: "c1", buy: "1,365", sell: "1,378.5" }),
    ).toEqual({ currencyId: "c1", buy: "1365", sell: "1378.5" });
  });
});
