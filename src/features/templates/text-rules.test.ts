import { describe, expect, it } from "vitest";

import {
  percentPillFontSize,
  pofNoteBelow,
  pricePillFontSize,
  compactPriceFontSize,
  cryptoNetworksShown,
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

describe("crypto rows", () => {
  it("steps the 200px price boxes down from 56px after 6 characters", () => {
    expect(compactPriceFontSize("1615")).toBe(56);
    expect(compactPriceFontSize("123456")).toBe(48);
    expect(compactPriceFontSize("1234567")).toBe(42);
    expect(compactPriceFontSize("99999.99")).toBe(38);
    expect(compactPriceFontSize("12345678901")).toBe(27);
  });

  it("keeps both tags when they fit, else drops the second", () => {
    expect(cryptoNetworksShown("USD Coin", ["ERC20", "BEP20"])).toEqual([
      "ERC20",
      "BEP20",
    ]);
    expect(cryptoNetworksShown("Tether", ["TRC20", "BEP20", "ERC20"])).toEqual([
      "TRC20",
      "BEP20",
    ]);
    expect(
      cryptoNetworksShown("Mmmmmmmmmmmmmmmmmmmm", ["ARBITRUM", "OPTIMISM"]),
    ).toEqual(["ARBITRUM"]);
    expect(cryptoNetworksShown("Solana", [])).toEqual([]);
  });
});
