import { describe, expect, it } from "vitest";

import { updatedLabel } from "@/features/public/updated-label";

const LAGOS = "Africa/Lagos";

describe("updatedLabel", () => {
  it("says today for a board made today in the org zone", () => {
    expect(
      updatedLabel(
        new Date("2026-10-09T09:25:00Z"),
        new Date("2026-10-09T20:00:00Z"),
        LAGOS,
      ),
    ).toBe("Updated today, 10:25 AM");
  });

  it("names the day otherwise", () => {
    expect(
      updatedLabel(
        new Date("2026-10-09T09:25:00Z"),
        new Date("2026-10-10T08:00:00Z"),
        LAGOS,
      ),
    ).toBe("Updated Fri 9 Oct, 10:25 AM");
  });

  it("uses the org's day, not UTC's", () => {
    // 23:30 UTC on the 8th is 00:30 on the 9th in Lagos
    expect(
      updatedLabel(
        new Date("2026-10-08T23:30:00Z"),
        new Date("2026-10-09T10:00:00Z"),
        LAGOS,
      ),
    ).toBe("Updated today, 12:30 AM");
  });
});
