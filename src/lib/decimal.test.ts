import { describe, expect, it } from "vitest";

import {
  compareDecimalStrings,
  multiplyDecimalStrings,
  subtractDecimalStrings,
  toDecimalString,
} from "@/lib/decimal";

describe("toDecimalString", () => {
  it("accepts strings and Decimal-like objects", () => {
    expect(toDecimalString("1365.0000")).toBe("1365.0000");
    expect(toDecimalString({ toFixed: () => "0.0000001" })).toBe("0.0000001");
  });

  it("rejects anything that is not a plain decimal", () => {
    expect(() => toDecimalString("1e-7")).toThrow();
    expect(() => toDecimalString("")).toThrow();
    expect(() => toDecimalString("1,365")).toThrow();
  });
});

describe("compareDecimalStrings", () => {
  it("compares by value, not by text", () => {
    expect(compareDecimalStrings("1365", "1365.0000")).toBe(0);
    expect(compareDecimalStrings("9.9", "10")).toBe(-1);
    expect(compareDecimalStrings("10", "9.9")).toBe(1);
    expect(compareDecimalStrings("0.05", "0.5")).toBe(-1);
    expect(compareDecimalStrings("1378.25", "1378.2")).toBe(1);
    expect(compareDecimalStrings("007", "7.0")).toBe(0);
  });

  it("handles signs", () => {
    expect(compareDecimalStrings("-1", "0.5")).toBe(-1);
    expect(compareDecimalStrings("-2", "-1")).toBe(-1);
    expect(compareDecimalStrings("-0", "0")).toBe(0);
  });
});

describe("subtractDecimalStrings", () => {
  it("is exact where floats are not", () => {
    expect(subtractDecimalStrings("0.3", "0.1")).toBe("0.2");
    expect(subtractDecimalStrings("1365.0000", "1360.5")).toBe("4.5");
    expect(subtractDecimalStrings("1360", "1365")).toBe("-5");
    expect(subtractDecimalStrings("3.40", "3.4")).toBe("0");
    expect(subtractDecimalStrings("3.4", "3.45")).toBe("-0.05");
  });
});

describe("multiplyDecimalStrings", () => {
  it("multiplies exactly, without floats", () => {
    expect(multiplyDecimalStrings("500", "1580")).toBe("790000");
    expect(multiplyDecimalStrings("500", "1580.0000")).toBe("790000");
    expect(multiplyDecimalStrings("0.1", "0.2")).toBe("0.02");
    expect(multiplyDecimalStrings("500", "1612.75")).toBe("806375");
    expect(multiplyDecimalStrings("-2", "3.5")).toBe("-7");
    expect(multiplyDecimalStrings("0", "-3")).toBe("0");
  });
});
