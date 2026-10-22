import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/server/db", () => ({
  db: { referralCode: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

const { referralForSubmit } = await import("@/features/referrals/link");
const { CODE_NOT_FOUND } = await import("@/features/referrals/attach");

const ACTIVE = {
  id: "c1",
  code: "IBEH",
  kind: "STAFF",
  membershipId: "m1",
  customerWhatsapp: null,
  active: true,
};

describe("the referral that goes with a website deal", () => {
  beforeEach(() => findUnique.mockReset());

  it("uses the link's cookie when the form had no field (no campaign, or a cached form)", async () => {
    findUnique.mockResolvedValue(ACTIVE);
    const r = await referralForSubmit("org1", undefined, "ibeh");
    expect(r).toMatchObject({ ok: true, referral: { code: { id: "c1" } } });
  });

  it("records an unknown or inactive cookie code as skipped, never blocking the deal", async () => {
    findUnique.mockResolvedValue(null);
    expect(await referralForSubmit("org1", undefined, "NOPE9999")).toEqual({
      ok: true,
      referral: { skipped: { code: "NOPE9999", reason: "unknown_code" } },
    });
    findUnique.mockResolvedValue({ ...ACTIVE, active: false });
    expect(await referralForSubmit("org1", undefined, "IBEH")).toEqual({
      ok: true,
      referral: { skipped: { code: "IBEH", reason: "inactive_code" } },
    });
  });

  it("refuses a typed unknown or inactive code with the friendly error", async () => {
    findUnique.mockResolvedValue(null);
    expect(await referralForSubmit("org1", "NOPE9999", "IBEH")).toEqual({
      ok: false,
      error: CODE_NOT_FOUND,
    });
  });

  it("takes the form's code over the cookie, and an emptied field as no code", async () => {
    findUnique.mockResolvedValue(ACTIVE);
    await referralForSubmit("org1", "IBEH", "OTHER1");
    expect(findUnique.mock.calls[0]![0].where.organizationId_code.code).toBe(
      "IBEH",
    );
    expect(await referralForSubmit("org1", "", "IBEH")).toEqual({
      ok: true,
      referral: undefined,
    });
  });

  it("has nothing to record with no field and no cookie", async () => {
    expect(await referralForSubmit("org1", undefined, undefined)).toEqual({
      ok: true,
      referral: undefined,
    });
    expect(findUnique).not.toHaveBeenCalled();
  });
});
