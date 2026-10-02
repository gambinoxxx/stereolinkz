import { describe, expect, it } from "vitest";

import {
  BADGE_PALETTE,
  badgeTextColor,
  coinLetter,
  defaultBadgeColor,
} from "@/features/coins/badge-color";
import { contrastRatio } from "@/features/settings/contrast";

describe("defaultBadgeColor", () => {
  it("is deterministic, case-insensitive and from the palette", () => {
    expect(defaultBadgeColor("TON")).toBe(defaultBadgeColor("ton"));
    for (const ticker of ["BTC", "ETH", "USDT", "SOL", "TON", "X1"])
      expect(BADGE_PALETTE).toContain(defaultBadgeColor(ticker));
  });

  it("spreads tickers over the palette", () => {
    const tickers = [
      "BTC",
      "ETH",
      "USDT",
      "USDC",
      "SOL",
      "BNB",
      "TRX",
      "LTC",
      "TON",
      "XRP",
    ];
    expect(new Set(tickers.map(defaultBadgeColor)).size).toBeGreaterThan(4);
  });
});

describe("badgeTextColor", () => {
  it("picks whichever of white and the dark board text contrasts more", () => {
    for (const colour of BADGE_PALETTE) {
      const text = badgeTextColor(colour);
      const other = text === "#FFFFFF" ? "#1F0B3F" : "#FFFFFF";
      expect(contrastRatio(colour, text)).toBeGreaterThanOrEqual(
        contrastRatio(colour, other),
      );
    }
    expect(badgeTextColor("#E0A100")).toBe("#1F0B3F");
    expect(badgeTextColor("#2A0F58")).toBe("#FFFFFF");
  });
});

describe("coinLetter", () => {
  it("uses the first letter of the name, else the ticker", () => {
    expect(coinLetter("Tether", "USDT")).toBe("T");
    expect(coinLetter("  ", "TON")).toBe("T");
  });
});
