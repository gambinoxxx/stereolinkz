import { describe, expect, it } from "vitest";

import {
  accountNameDiffers,
  dealSettingsInput,
  formatAccountNumber,
  paymentAccountInput,
} from "@/features/deals/settings-schema";

const account = {
  bank: "A bank",
  accountNumber: "1306 482 951",
  accountName: "Stereolinkz Ltd",
  currency: "ngn",
  services: ["SCHOOL_FEES"],
  active: true,
};

describe("paymentAccountInput", () => {
  it("accepts a 10-digit NGN account, spaces removed", () => {
    expect(paymentAccountInput.parse(account)).toMatchObject({
      accountNumber: "1306482951",
      currency: "NGN",
    });
  });
  it("requires 10 digits for NGN", () => {
    for (const n of ["123456789", "12345678901", "12345ABCDE"])
      expect(
        paymentAccountInput.safeParse({ ...account, accountNumber: n }).success,
        n,
      ).toBe(false);
  });
  it("allows longer account numbers for other currencies", () => {
    expect(
      paymentAccountInput.safeParse({
        ...account,
        currency: "GBP",
        accountNumber: "GB29 NWBK 6016 1331 9268 19",
      }).success,
    ).toBe(true);
  });
  it("requires a name, a bank and a service", () => {
    expect(
      paymentAccountInput.safeParse({ ...account, accountName: " " }).success,
    ).toBe(false);
    expect(
      paymentAccountInput.safeParse({ ...account, bank: "" }).success,
    ).toBe(false);
    expect(
      paymentAccountInput.safeParse({ ...account, services: [] }).success,
    ).toBe(false);
    expect(
      paymentAccountInput.safeParse({ ...account, services: ["NOPE"] }).success,
    ).toBe(false);
  });
  it("allows crypto payouts (Phase 13)", () => {
    expect(
      paymentAccountInput.safeParse({ ...account, services: ["CRYPTO_SELL"] })
        .success,
    ).toBe(true);
  });
});

describe("dealSettingsInput", () => {
  const settings = {
    services: [],
    contactSlaMinutes: "15",
    dealRefPrefix: "slz",
    dealAlertEmails: false,
    dealDefaultOwnerId: "",
    rateLockMinutes: "30",
    payoutTargetMinutes: "10",
    cryptoMinQty: "20",
    cryptoMaxUsd: "5,000",
    payoutAlertEmails: true,
  };
  it("normalises the prefix and the owner", () => {
    expect(dealSettingsInput.parse(settings)).toEqual({
      services: [],
      contactSlaMinutes: 15,
      dealRefPrefix: "SLZ",
      dealAlertEmails: false,
      dealDefaultOwnerId: null,
      rateLockMinutes: 30,
      payoutTargetMinutes: 10,
      cryptoMinQty: "20",
      cryptoMaxUsd: "5000",
      payoutAlertEmails: true,
    });
  });
  it("keeps crypto switched on when saved (Phase 13)", () => {
    expect(
      dealSettingsInput.parse({ ...settings, services: ["CRYPTO_SELL"] })
        .services,
    ).toEqual(["CRYPTO_SELL"]);
  });
  it("checks the crypto limits and timings", () => {
    for (const bad of [
      { rateLockMinutes: "2" },
      { payoutTargetMinutes: "0" },
      { cryptoMinQty: "0" },
      { cryptoMinQty: "20.555" },
      { cryptoMaxUsd: "10" },
    ])
      expect(
        dealSettingsInput.safeParse({ ...settings, ...bad }).success,
        JSON.stringify(bad),
      ).toBe(false);
  });
  it("rejects bad prefixes and SLA", () => {
    for (const p of ["S", "SLZ-1", "TOOLONGX", "S1Z"])
      expect(
        dealSettingsInput.safeParse({ ...settings, dealRefPrefix: p }).success,
        p,
      ).toBe(false);
    for (const m of ["0", "1441", "1.5", "abc"])
      expect(
        dealSettingsInput.safeParse({ ...settings, contactSlaMinutes: m })
          .success,
        m,
      ).toBe(false);
  });
});

describe("accountNameDiffers", () => {
  it("is false when the name contains the organization's", () => {
    expect(accountNameDiffers("Stereolinkz Ltd", "Stereolinkz")).toBe(false);
    expect(accountNameDiffers("STEREOLINKZ LIMITED", "Stereolinkz")).toBe(
      false,
    );
    expect(accountNameDiffers("Stereo-Linkz Ltd", "Stereolinkz")).toBe(false);
  });
  it("is true for another name", () => {
    expect(accountNameDiffers("Bopstore Enterprises", "Stereolinkz")).toBe(
      true,
    );
  });
});

describe("formatAccountNumber", () => {
  it("groups 10 digits 4-3-3", () => {
    expect(formatAccountNumber("1306482951")).toBe("1306 482 951");
    expect(formatAccountNumber("GB29NWBK")).toBe("GB29NWBK");
  });
});
