import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BANK_MARK_HEX,
  boardTheme,
  purpleGradient,
  shade,
} from "@/features/templates/theme";

const brand = {
  name: "Acme",
  logoUrl: null,
  backgroundColor: null,
  primaryColor: null,
  accentColor: null,
  contactLine: null,
};

describe("shade", () => {
  it("scales brightness and clamps", () => {
    expect(shade("#2A0F58", 1)).toBe("#2A0F58");
    expect(shade("#2A0F58", 1.4)).toBe("#3B157B");
    expect(shade("#2A0F58", 0.67)).toBe("#1C0A3B");
    expect(shade("#FFFFFF", 2)).toBe("#FFFFFF");
    expect(shade("#101010", 0)).toBe("#000000");
  });

  it("returns invalid input unchanged", () => {
    expect(shade("purple", 1.4)).toBe("purple");
  });
});

describe("purpleGradient", () => {
  it("keeps the design's exact stops for the design's colour or none", () => {
    const design =
      "linear-gradient(165deg, #3B1675 0%, #2A0F58 45%, #1C0A3D 100%)";
    expect(purpleGradient(null)).toBe(design);
    expect(purpleGradient("#2a0f58")).toBe(design);
    expect(purpleGradient("not a colour")).toBe(design);
  });

  it("derives top and bottom stops from another brand colour", () => {
    expect(purpleGradient("#0A3D2F")).toBe(
      "linear-gradient(165deg, #0E5542 0%, #0A3D2F 45%, #07291F 100%)",
    );
  });
});

describe("boardTheme", () => {
  it("applies brand primary and accent colours to both themes", () => {
    const t = boardTheme("daylight", {
      ...brand,
      primaryColor: "#123456",
      accentColor: "#ABCDEF",
      backgroundColor: "#000000",
    });
    expect(t.primary).toBe("#123456");
    expect(t.accent).toBe("#ABCDEF");
    // Daylight ignores the brand background: it stays light.
    expect(t.background).toContain("#FFFFFF 0%");
  });

  it("falls back to the design's colours when the brand has none", () => {
    const t = boardTheme("purple-signal", brand);
    expect(t.primary).toBe("#6A35D9");
    expect(t.accent).toBe("#E9B949");
  });
});

describe("BANK_MARK_HEX", () => {
  it("matches --bank-mark-1…6 in globals.css", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    const fromCss = [1, 2, 3, 4, 5, 6].map((i) =>
      new RegExp(`--bank-mark-${i}:\\s*(#[0-9a-f]{6})`, "i")
        .exec(css)?.[1]
        ?.toUpperCase(),
    );
    expect(fromCss).toEqual([...BANK_MARK_HEX]);
  });
});
