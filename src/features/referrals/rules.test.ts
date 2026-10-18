import { describe, expect, it } from "vitest";

import {
  acceptsService,
  defaultWindow,
  displayStatus,
  isApprovable,
  isProgrammeActive,
  normalizeCode,
  passesCap,
  pendingReason,
  referrerKey,
  rewardAmount,
} from "@/features/referrals/rules";

const on = {
  referralEnabled: true,
  referralStartsAt: new Date("2026-10-18T00:00:00Z"),
  referralEndsAt: new Date("2026-12-18T00:00:00Z"),
  referralServices: ["POF", "FOREX_SELL"] as ("POF" | "FOREX_SELL")[],
};

describe("reward maths", () => {
  it("is 15% of our profit, rounded down to whole naira", () => {
    expect(rewardAmount("100000", "15")).toBe("15000");
    expect(rewardAmount("12345.67", "15")).toBe("1851"); // 1851.85…
    expect(rewardAmount("6", "15")).toBe("0"); // 0.9
    expect(rewardAmount("0", "15")).toBe("0");
    expect(rewardAmount("840000", "12.5")).toBe("105000");
    expect(rewardAmount("99.99", "100")).toBe("99");
  });
  it("never uses floats", () => {
    // 0.1 + 0.2 style traps: 19.99 × 15% = 2.9985 → 2
    expect(rewardAmount("19.99", "15")).toBe("2");
    expect(rewardAmount("1000000000000.5", "15")).toBe("150000000000");
  });
});

describe("programme window", () => {
  it("is on only when switched on and inside the dates", () => {
    expect(isProgrammeActive(on, new Date("2026-11-01T00:00:00Z"))).toBe(true);
    expect(isProgrammeActive(on, new Date("2026-10-17T23:59:59Z"))).toBe(false);
    expect(isProgrammeActive(on, new Date("2026-12-18T00:00:00Z"))).toBe(false);
    expect(
      isProgrammeActive(
        { ...on, referralEnabled: false },
        new Date("2026-11-01T00:00:00Z"),
      ),
    ).toBe(false);
    expect(
      isProgrammeActive(
        { ...on, referralStartsAt: null },
        new Date("2026-11-01T00:00:00Z"),
      ),
    ).toBe(false);
  });
  it("only for the eligible services", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    expect(acceptsService(on, "POF", now)).toBe(true);
    expect(acceptsService(on, "CRYPTO_SELL", now)).toBe(false);
  });
  it("defaults to two months from switching on", () => {
    const w = defaultWindow(new Date("2026-10-18T09:00:00Z"));
    expect(w.endsAt.toISOString()).toBe("2026-12-18T09:00:00.000Z");
  });
});

describe("codes", () => {
  it("are 4–12 letters and digits, uppercased", () => {
    expect(normalizeCode(" lydia ")).toBe("LYDIA");
    expect(normalizeCode("ADA482")).toBe("ADA482");
    expect(normalizeCode("ab")).toBeNull();
    expect(normalizeCode("LYDIA-1")).toBeNull();
    expect(normalizeCode("ABCDEFGHIJKLM")).toBeNull();
    expect(normalizeCode(42)).toBeNull();
  });
  it("count towards one referrer per member or number", () => {
    expect(
      referrerKey({
        kind: "STAFF",
        membershipId: "m1",
        customerWhatsapp: null,
      }),
    ).toBe("m:m1");
    expect(
      referrerKey({
        kind: "CUSTOMER",
        membershipId: null,
        customerWhatsapp: "+2348031234567",
      }),
    ).toBe("w:+2348031234567");
  });
});

describe("status flow", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const base = {
    status: "PENDING" as const,
    holdUntil: new Date("2026-11-08T00:00:00Z"),
    notBefore: null,
    flag: null,
  };
  it("is READY once the hold is over", () => {
    expect(displayStatus(base, now)).toBe("READY");
    expect(
      displayStatus(
        { ...base, holdUntil: new Date("2026-11-12T00:00:00Z") },
        now,
      ),
    ).toBe("PENDING");
  });
  it("stays PENDING while capped this month, and says why", () => {
    const capped = { ...base, notBefore: new Date("2026-12-01T00:00:00Z") };
    expect(displayStatus(capped, now)).toBe("PENDING");
    expect(isApprovable(capped, now)).toBe(false);
    expect(pendingReason(capped, now)).toBe("Cap reached: next month");
    expect(isApprovable(capped, new Date("2026-12-01T00:00:00Z"))).toBe(true);
  });
  it("never shows a flagged reward as READY", () => {
    const flagged = { ...base, flag: "Check: possible self-referral" };
    expect(displayStatus(flagged, now)).toBe("PENDING");
    expect(isApprovable(flagged, now)).toBe(true); // one at a time, after a check
  });
  it("shows APPROVED, PAID and VOID as they are", () => {
    for (const status of ["APPROVED", "PAID", "VOID"] as const)
      expect(displayStatus({ ...base, status }, now)).toBe(status);
  });
});

describe("monthly cap", () => {
  it("holds a reward that would pass the cap", () => {
    expect(passesCap(null, "900000", "500000")).toBe(false);
    expect(passesCap("1000000", "900000", "100000")).toBe(false);
    expect(passesCap("1000000", "900000", "100001")).toBe(true);
    expect(passesCap("1000000.00000000", "0", "1000000")).toBe(false);
  });
});
