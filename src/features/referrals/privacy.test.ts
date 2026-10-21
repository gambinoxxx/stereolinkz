import { describe, expect, it } from "vitest";

import { LEDGER_SELECT } from "@/features/referrals/ledger-select";
import { ownerOnly, OWNER_ONLY } from "@/features/referrals/owner";

describe("the referrer's view", () => {
  it("never reads the referred customer's contact details or files", () => {
    const keys = Object.keys(LEDGER_SELECT);
    for (const k of [
      "customerName",
      "customerWhatsapp",
      "customerEmail",
      "payoutAccountName",
      "payoutAccountNumber",
      "files",
      "deal",
      "details",
    ])
      expect(keys).not.toContain(k);
    expect(keys).toEqual(
      expect.arrayContaining([
        "dealRef",
        "service",
        "createdAt",
        "amountNaira",
        "status",
      ]),
    );
  });
});

describe("owner-only actions", () => {
  it("refuse anyone but the owner", () => {
    expect(ownerOnly({ role: "OWNER" })).toBeNull();
    for (const role of ["ADMIN", "EDITOR", "VIEWER"] as const)
      expect(ownerOnly({ role })).toEqual({ ok: false, error: OWNER_ONLY });
  });
});

describe("every referral action that changes the programme or rewards", () => {
  it("checks the owner first, in the action itself", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
    const actions = src.split(/export const (\w+) = safeAction\(/).slice(1);
    const names: string[] = [];
    for (let i = 0; i < actions.length; i += 2) {
      const name = actions[i]!;
      const body = actions[i + 1]!;
      names.push(name);
      // Any team member may add a code to a New deal, remove one, or make
      // a customer's new private link (each with its own checks).
      if (
        [
          "attachDealReferral",
          "removeDealReferral",
          "newReferralPageLink",
        ].includes(name)
      )
        continue;
      const guard = body.indexOf("ownerOnly(member)");
      const firstDb = body.search(/\bdb\.|\$transaction|parse\(/);
      expect(guard, `${name} checks the owner`).toBeGreaterThan(-1);
      expect(
        guard,
        `${name} checks the owner before anything else`,
      ).toBeLessThan(firstDb);
    }
    expect(names).toEqual(
      expect.arrayContaining([
        "updateProgrammeRules",
        "createCampaign",
        "startCampaign",
        "endCampaign",
        "createStaffCode",
        "deactivateReferralCode",
        "approveRewards",
        "payRewards",
        "voidReward",
      ]),
    );
  });
});
