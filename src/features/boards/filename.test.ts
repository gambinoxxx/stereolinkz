import { describe, expect, it } from "vitest";

import { boardFilename } from "@/features/boards/filename";

describe("boardFilename", () => {
  it("builds <brand>-<type>-<time>.png from the org name and time label", () => {
    expect(boardFilename("Stereolinkz", "FOREX", "10:25 AM")).toBe(
      "stereolinkz-forex-1025am.png",
    );
    expect(boardFilename("Stereolinkz", "POF", "4:05 PM")).toBe(
      "stereolinkz-pof-405pm.png",
    );
    expect(boardFilename("Stereolinkz", "CRYPTO", "10:25 AM")).toBe(
      "stereolinkz-crypto-1025am.png",
    );
  });

  it("slugs any org name, including accents and punctuation", () => {
    expect(boardFilename("  Café & Co. FX ", "FOREX", "12:00 PM")).toBe(
      "cafe-co-fx-forex-1200pm.png",
    );
  });

  it("falls back when the name has no letters or the time is missing", () => {
    expect(boardFilename("★★", "POF", "")).toBe("board-pof.png");
  });
});
