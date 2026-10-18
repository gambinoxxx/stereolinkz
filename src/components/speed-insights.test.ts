import { describe, expect, it } from "vitest";

import { sanitizeVitalsUrl } from "@/components/speed-insights";

describe("sanitizeVitalsUrl", () => {
  it("drops a deal's tracking token and reference", () => {
    expect(
      sanitizeVitalsUrl("https://stereolinkz.com/deal/SLZ-1047?t=secret#x"),
    ).toBe("https://stereolinkz.com/deal/[ref]");
    expect(
      sanitizeVitalsUrl("https://stereolinkz.com/admin/deals/SLZ-1047"),
    ).toBe("https://stereolinkz.com/admin/deals/[ref]");
  });
  it("keeps the other routes, without their query", () => {
    for (const path of [
      "/",
      "/deal/new",
      "/deal/new/pof",
      "/deal/check-eth",
      "/admin/deals",
      "/admin/deals/wallets",
    ])
      expect(sanitizeVitalsUrl(`https://stereolinkz.com${path}?amount=5`)).toBe(
        `https://stereolinkz.com${path}`,
      );
  });
});
