import { describe, expect, it } from "vitest";

import {
  noteInput,
  PERCENT_ERRORS,
  percentInput,
  pofRateInput,
} from "@/features/pof-rates/schema";

describe("percentInput", () => {
  it("accepts rates from 0 to 100, with or without %", () => {
    expect(percentInput.parse("3.4")).toBe("3.4");
    expect(percentInput.parse("3.40")).toBe("3.40");
    expect(percentInput.parse("3.4%")).toBe("3.4");
    expect(percentInput.parse(" 3.4 % ")).toBe("3.4");
    expect(percentInput.parse("0")).toBe("0");
    expect(percentInput.parse("100")).toBe("100");
  });

  it("rejects more than 2 decimals, text and negatives", () => {
    for (const bad of ["3.456", "-1", "abc", "", "1,5"]) {
      const result = percentInput.safeParse(bad);
      expect(result.success, bad).toBe(false);
      expect(result.error?.issues[0]?.message, bad).toBe(PERCENT_ERRORS.format);
    }
  });

  it("rejects rates above 100, comparing as decimals", () => {
    for (const bad of ["100.01", "101", "999"]) {
      expect(percentInput.safeParse(bad).error?.issues[0]?.message, bad).toBe(
        PERCENT_ERRORS.range,
      );
    }
  });
});

describe("noteInput", () => {
  it("trims a note and turns an empty one into null", () => {
    expect(noteInput.parse("  New account ")).toBe("New account");
    expect(noteInput.parse("   ")).toBeNull();
    expect(noteInput.parse("")).toBeNull();
  });

  it("accepts its own output, so a second parse doesn't fail", () => {
    expect(noteInput.parse(null)).toBeNull();
    expect(noteInput.parse(noteInput.parse("  "))).toBeNull();
    expect(
      pofRateInput.parse(
        pofRateInput.parse({
          bankId: "b",
          rate: "2.3",
          note: "",
          pofActive: false,
        }),
      ),
    ).toEqual({ bankId: "b", rate: "2.3", note: null, pofActive: false });
  });

  it("allows 24 characters and rejects 25", () => {
    expect(noteInput.parse("A".repeat(24))).toBe("A".repeat(24));
    expect(noteInput.safeParse("A".repeat(25)).success).toBe(false);
  });
});

describe("pofRateInput", () => {
  it("parses a full input", () => {
    expect(
      pofRateInput.parse({
        bankId: "b1",
        rate: "3.4%",
        note: " ",
        pofActive: true,
      }),
    ).toEqual({ bankId: "b1", rate: "3.4", note: null, pofActive: true });
  });

  it("needs a bank", () => {
    const result = pofRateInput.safeParse({
      bankId: "",
      rate: "3",
      note: "",
      pofActive: true,
    });
    expect(result.error?.issues[0]?.message).toBe("Pick a bank.");
  });
});
