import { describe, expect, it } from "vitest";

import {
  percentPillFontSize,
  pofNoteBelow,
  pricePillFontSize,
} from "@/features/templates/text-rules";

describe("pricePillFontSize", () => {
  it("steps down from 68px as prices get longer", () => {
    expect(pricePillFontSize("1365")).toBe(68);
    expect(pricePillFontSize("12345")).toBe(68);
    expect(pricePillFontSize("1365.5")).toBe(56);
    expect(pricePillFontSize("12345.5")).toBe(48);
    expect(pricePillFontSize("123456.8")).toBe(42);
    expect(pricePillFontSize("1815.1234")).toBe(37);
    expect(pricePillFontSize("12345.6789")).toBe(34);
    expect(pricePillFontSize("1234567890.1234")).toBe(30);
  });
});

describe("percentPillFontSize", () => {
  it("fits up to 5 characters at 56px", () => {
    expect(percentPillFontSize("3.4%")).toBe(56);
    expect(percentPillFontSize("12.5%")).toBe(56);
    expect(percentPillFontSize("99.99%")).toBe(46);
  });
});

describe("pofNoteBelow", () => {
  it("keeps short pairs inline and moves long ones under the name", () => {
    expect(pofNoteBelow("Providus", "New account")).toBe(false); // 19
    expect(pofNoteBelow("Wema", null)).toBe(false);
    expect(pofNoteBelow("Fourteen Chars", "New account")).toBe(true); // 25
    expect(pofNoteBelow("Shrt", "Twenty-four chars note!!")).toBe(true);
  });
});
