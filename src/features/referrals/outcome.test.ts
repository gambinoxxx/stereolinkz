import { describe, expect, it } from "vitest";

import { ATTACH_SKIP_LABELS } from "@/features/referrals/labels";
import { attachOutcome } from "@/features/referrals/outcome";
import { ATTACH_SKIPS } from "@/features/referrals/rules";

const skip = (code: string, reason: string, message = "words") => ({
  type: "REFERRAL",
  message,
  data: { code, applied: false, skip: reason },
});

describe("the deal page's referral line", () => {
  it("says who referred an attached deal", () => {
    expect(attachOutcome("IBEH", [])).toEqual({ attached: true, code: "IBEH" });
  });

  it("names every skip reason, with the code that came with the deal", () => {
    for (const reason of ATTACH_SKIPS) {
      expect(attachOutcome(null, [skip("IBEH", reason)])).toEqual({
        attached: false,
        code: "IBEH",
        reason,
        note: null,
      });
      expect(ATTACH_SKIP_LABELS[reason]).toBeTruthy();
    }
  });

  it("reads deals made before reasons were stored from their words", () => {
    const old = (message: string) => [
      { type: "REFERRAL", message, data: { code: "IBEH", applied: false } },
    ];
    expect(
      attachOutcome(
        null,
        old(
          "Referral code IBEH not applied: it’s the code owner’s own WhatsApp number",
        ),
      ),
    ).toMatchObject({ reason: "staff_own_number" });
    expect(
      attachOutcome(
        null,
        old(
          "Referral code IBEH not applied: this customer has completed a deal with us before",
        ),
      ),
    ).toMatchObject({ reason: "not_new_customer" });
    expect(
      attachOutcome(null, old("Referral code IBEH not applied: something new")),
    ).toEqual({
      attached: false,
      code: "IBEH",
      reason: "other",
      note: "Referral code IBEH not applied: something new",
    });
  });

  it("shows a removed referral with the team's reason, and no code given", () => {
    expect(
      attachOutcome(null, [
        {
          type: "REFERRAL",
          message: "applied",
          data: { code: "IBEH", applied: true },
        },
        {
          type: "REFERRAL_REMOVED",
          message: "removed",
          data: { code: "IBEH", reason: "Customer asked" },
        },
      ]),
    ).toEqual({
      attached: false,
      code: "IBEH",
      reason: "removed",
      note: "Customer asked",
    });
    expect(attachOutcome(null, [])).toMatchObject({ reason: "no_code" });
    // Reward events carry a code but aren't attach outcomes.
    expect(
      attachOutcome(null, [
        {
          type: "REFERRAL",
          message: "Referral reward …",
          data: { code: "IBEH" },
        },
      ]),
    ).toMatchObject({ reason: "no_code" });
  });
});
