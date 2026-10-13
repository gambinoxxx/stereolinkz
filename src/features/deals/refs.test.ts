import { describe, expect, it } from "vitest";

import { formatRef, normalizeRef } from "@/features/deals/refs";

describe("refs", () => {
  it("formats prefix and number", () => {
    expect(formatRef("SLZ", 1047)).toBe("SLZ-1047");
  });
  it("normalizes what a person types", () => {
    expect(normalizeRef(" slz-1047 ")).toBe("SLZ-1047");
    expect(normalizeRef("SLZ1047")).toBeNull();
    expect(normalizeRef("SLZ-")).toBeNull();
    expect(normalizeRef("../x")).toBeNull();
  });
});
