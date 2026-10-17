import { describe, expect, it } from "vitest";

import {
  addDecimalStrings,
  coinsForNaira,
  hexWordToUnits,
  sameAmount,
  uniqueAmount,
  unitsToDecimal,
} from "@/features/crypto-deposits/amounts";

describe("unitsToDecimal", () => {
  it("converts with the token's decimals, exactly", () => {
    expect(unitsToDecimal("200000000", 6)).toBe("200");
    expect(unitsToDecimal("200500000", 6)).toBe("200.5");
    expect(unitsToDecimal("1", 6)).toBe("0.000001");
    expect(unitsToDecimal("0", 6)).toBe("0");
    expect(unitsToDecimal("1991000000000000000000", 18)).toBe("1991");
    expect(unitsToDecimal("500370000", 6)).toBe("500.37");
  });

  it("refuses anything but digits", () => {
    expect(() => unitsToDecimal("-1", 6)).toThrow();
    expect(() => unitsToDecimal("1e6", 6)).toThrow();
  });
});

describe("hexWordToUnits", () => {
  it("reads a log data word", () => {
    expect(
      hexWordToUnits(
        "000000000000000000000000000000000000000000000000000000000bebc200",
      ),
    ).toBe("200000000");
  });
});

describe("addDecimalStrings", () => {
  it("adds exactly", () => {
    expect(addDecimalStrings("500", "0.37")).toBe("500.37");
    expect(addDecimalStrings("0.1", "0.2")).toBe("0.3");
  });
});

describe("uniqueAmount", () => {
  it("keeps the typed amount when no open deal expects it", () => {
    expect(uniqueAmount("500", ["300.00", "500.37"])).toBe("500.00");
  });

  it("adds a free cents suffix when the amount is taken", () => {
    const got = uniqueAmount("500", ["500.000000000000000000"], () => 0.5);
    expect(got).toMatch(/^500\.\d\d$/);
    expect(got).not.toBe("500.00");
  });

  it("never reuses a taken suffix", () => {
    const taken = [
      "500.00",
      ...Array.from(
        { length: 98 },
        (_, i) => `500.${String(i + 1).padStart(2, "0")}`,
      ),
    ];
    expect(uniqueAmount("500", taken)).toBe("500.99");
    expect(uniqueAmount("500", [...taken, "500.99"])).toBeNull();
  });

  it("works from an amount that already has cents", () => {
    expect(uniqueAmount("20.5", ["20.50"], () => 0)).toMatch(/^20\.\d\d$/);
  });
});

describe("sameAmount", () => {
  it("compares by value", () => {
    expect(sameAmount("500.370000000000000000", "500.37")).toBe(true);
    expect(sameAmount("500.37", "500.3700001")).toBe(false);
  });
});

describe("coinsForNaira", () => {
  it("divides exactly and rounds down to cents", () => {
    expect(coinsForNaira("795000", "1590")).toBe("500.00");
    expect(coinsForNaira("1000", "1590")).toBe("0.62");
    expect(coinsForNaira("1000", "0")).toBeNull();
  });
});
