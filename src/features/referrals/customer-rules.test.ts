import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  bpsToPct,
  CODE_ALPHABET,
  campaignInForce,
  CUSTOMER_CODE_PATTERN,
  customerCodeFrom,
  FIRST_DEAL_ONLY,
  maskPhone,
  rewardFromBps,
  serviceEligible,
} from "@/features/referrals/rules";
import { pctToBps } from "@/features/referrals/schema";

describe("customer codes", () => {
  it("are SLZ + 5 characters with no 0/O, 1/I or L", () => {
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
    for (let i = 0; i < 500; i++) {
      const code = customerCodeFrom(randomBytes(16))!;
      expect(code).toMatch(CUSTOMER_CODE_PATTERN);
      expect(code.slice(3)).not.toMatch(/[01OIL]/);
    }
  });
  it("skip the bytes that would bias the draw, and ask again when short", () => {
    // 248–255 are rejected (248 = 31 × 8); 0 → "2", 30 → "Z".
    expect(customerCodeFrom(Uint8Array.from([255, 0, 248, 30, 1, 2, 3]))).toBe(
      "SLZ2Z345",
    );
    expect(customerCodeFrom(Uint8Array.from([250, 251, 1]))).toBeNull();
  });
  it("fit the stored code rule (4–12 letters and digits)", () => {
    expect(customerCodeFrom(randomBytes(16))).toMatch(/^[A-Z0-9]{4,12}$/);
  });
});

describe("customer-side reward maths", () => {
  it("is the campaign's bps of our profit, rounded down", () => {
    expect(rewardFromBps("100000", 1500)).toBe("15000");
    expect(rewardFromBps("12345.67", 1500)).toBe("1851"); // 1851.85…
    expect(rewardFromBps("29999", 1500)).toBe("4499"); // 4499.85
    expect(rewardFromBps("840000", 1250)).toBe("105000");
  });
  it("gives nothing for no profit", () => {
    expect(rewardFromBps("0", 1500)).toBe("0");
    expect(rewardFromBps("6", 1500)).toBe("0");
  });
  it("converts between % and bps without floats", () => {
    expect(pctToBps("15")).toBe(1500);
    expect(pctToBps("12.5")).toBe(1250);
    expect(pctToBps("0.05")).toBe(5);
    expect(bpsToPct(1500)).toBe("15");
    expect(bpsToPct(1250)).toBe("12.5");
  });
  it("counts only a referred customer's first deal", () => {
    expect(FIRST_DEAL_ONLY).toBe(true);
  });
});

describe("campaigns", () => {
  const c = {
    active: true,
    startsAt: new Date("2026-11-01T00:00:00Z"),
    endsAt: new Date("2027-01-01T00:00:00Z"),
  };
  it("are in force only when on and inside their dates", () => {
    expect(campaignInForce(c, new Date("2026-12-01T00:00:00Z"))).toBe(true);
    expect(campaignInForce(c, new Date("2026-10-31T23:59:59Z"))).toBe(false);
    expect(campaignInForce(c, new Date("2027-01-01T00:00:00Z"))).toBe(false);
    expect(
      campaignInForce(
        { ...c, active: false },
        new Date("2026-12-01T00:00:00Z"),
      ),
    ).toBe(false);
  });
  it("exclude crypto unless the campaign includes it", () => {
    expect(serviceEligible({ includeCrypto: false }, "POF")).toBe(true);
    expect(serviceEligible({ includeCrypto: false }, "CRYPTO_SELL")).toBe(
      false,
    );
    expect(serviceEligible({ includeCrypto: true }, "CRYPTO_SELL")).toBe(true);
  });
});

describe("masking", () => {
  it("keeps only the country code and the last four digits", () => {
    expect(maskPhone("+234 803 123 4567")).toBe("+234 ••• ••• 4567");
    expect(maskPhone("")).toBe("•••");
  });
});
