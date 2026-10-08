import { describe, expect, it } from "vitest";

import { estimateNaira } from "@/features/public/estimate";

describe("estimateNaira", () => {
  it("multiplies to whole naira", () => {
    expect(estimateNaira("500", "1365.0000")).toBe("682500");
  });

  it("is exact where floats are not", () => {
    // 0.1 × 3 is 0.30000000000000004 as floats
    expect(estimateNaira("0.1", "3")).toBe("0");
    expect(estimateNaira("1.005", "1000")).toBe("1005");
    expect(estimateNaira("123456789.99", "1580")).toBe("195061728184");
  });

  it("rounds half up", () => {
    expect(estimateNaira("1.5", "1")).toBe("2");
    expect(estimateNaira("1.49", "1")).toBe("1");
    expect(estimateNaira("2.5", "1.5")).toBe("4"); // 3.75
  });

  it("accepts thousands separators and spaces", () => {
    expect(estimateNaira(" 1,200 ", "1590")).toBe("1908000");
  });

  it("rejects negative and non-numeric input", () => {
    expect(estimateNaira("-5", "1365")).toBeNull();
    expect(estimateNaira("abc", "1365")).toBeNull();
    expect(estimateNaira("", "1365")).toBeNull();
    expect(estimateNaira("1e3", "1365")).toBeNull();
    expect(estimateNaira("12.", "1365")).toBeNull();
    expect(estimateNaira("5", "-1365")).toBeNull();
    expect(estimateNaira("5", "x")).toBeNull();
  });

  it("is zero for a zero amount", () => {
    expect(estimateNaira("0", "1365")).toBe("0");
  });
});
