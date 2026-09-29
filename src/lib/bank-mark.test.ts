import { describe, expect, it } from "vitest";

import { BANK_MARK_COLORS, bankMarkIndex, bankMonogram } from "@/lib/bank-mark";

describe("bankMarkIndex", () => {
  it("is stable for a slug and inside the palette", () => {
    for (const slug of ["eco", "acme", "firstcity", "", "a"]) {
      const index = bankMarkIndex(slug);
      expect(index).toBe(bankMarkIndex(slug));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(BANK_MARK_COLORS);
    }
  });

  it("spreads different slugs over the palette", () => {
    const slugs = Array.from({ length: 60 }, (_, i) => `bank${i}`);
    const used = new Set(slugs.map(bankMarkIndex));
    expect(used.size).toBe(BANK_MARK_COLORS);
  });
});

describe("bankMonogram", () => {
  it("takes the first letter or digit, upper-cased", () => {
    expect(bankMonogram("acme Bank")).toBe("A");
    expect(bankMonogram("  (9) Payments")).toBe("9");
    expect(bankMonogram("—")).toBe("?");
  });
});
