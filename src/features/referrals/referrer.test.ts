import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_SITE_URL = "https://stereolinkz.com";

const db = {
  referralCode: { findUnique: vi.fn(), findFirst: vi.fn() },
  organization: { findUniqueOrThrow: vi.fn() },
  deal: { findUnique: vi.fn() },
};
vi.mock("@/lib/server/db", () => ({ db }));
vi.mock("@/features/deals/public-queries", () => ({
  getDealDeskContext: async () => ({
    org: { id: "org1", name: "Stereolinkz", contactLine: "+234 810 978 3417" },
  }),
}));
const findDealIdByToken = vi.fn();
vi.mock("@/features/deals/access", () => ({
  findDealIdByToken: (...a: unknown[]) => findDealIdByToken(...a),
}));
const campaignInForceNow = vi.fn();
vi.mock("@/features/referrals/attach", () => ({
  campaignInForceNow: (...a: unknown[]) => campaignInForceNow(...a),
}));

const { REFERRER_DEAL_SELECT, referrerByDeal, referrerByPageToken } =
  await import("@/features/referrals/referrer-queries");
const { ReferrerView } =
  await import("@/features/referrals/components/customer/ReferrerView");
const { default: ReferralsPage } =
  await import("@/app/(public)/referrals/[token]/page");

const GOOD_TOKEN = "A".repeat(43);
const NOW = new Date("2026-11-10T12:00:00Z");

// A referred deal as the database would hold it, with the referred
// person's details on it: none of them may reach the referrer.
const PRIVATE = {
  customerName: "Adaeze Okafor",
  customerWhatsapp: "+234 803 555 0199",
  customerEmail: "adaeze@example.com",
  amount: "2500",
  payoutAccountNumber: "0123456789",
};
const referred = (ref: string, status: string, reward: unknown) => ({
  ref,
  status,
  createdAt: NOW,
  referralReward: reward,
  ...PRIVATE,
});
const reward = (amount: string, status: string) => ({
  amountNaira: { toFixed: () => amount },
  status,
  holdUntil: new Date("2026-11-01T00:00:00Z"),
  notBefore: null,
  flag: null,
});

beforeEach(() => {
  for (const t of [db.referralCode, db.organization, db.deal])
    for (const f of Object.values(t)) f.mockReset();
  findDealIdByToken.mockReset();
  campaignInForceNow.mockReset().mockResolvedValue({
    rewardBps: 1500,
    endsAt: new Date("2026-12-20T23:00:00Z"), // 21 Dec, 00:00 in Lagos
  });
  db.organization.findUniqueOrThrow.mockResolvedValue({
    timezone: "Africa/Lagos",
  });
});

describe("a bad referral page token", () => {
  it("is refused before the database for anything not shaped like a token", async () => {
    for (const t of [
      "",
      "abc",
      "SLZ7KQ4M",
      `${GOOD_TOKEN}A`,
      "x".repeat(42) + "!",
    ])
      expect(await referrerByPageToken(t, NOW)).toBeNull();
    expect(db.referralCode.findUnique).not.toHaveBeenCalled();
  });

  it("is looked up by its hash only, and unknown is simply nothing", async () => {
    db.referralCode.findUnique.mockResolvedValue(null);
    expect(await referrerByPageToken(GOOD_TOKEN, NOW)).toBeNull();
    const where = db.referralCode.findUnique.mock.calls[0]![0].where;
    expect(where.pageTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(where)).not.toContain(GOOD_TOKEN);
  });

  it("for a switched-off code is the same nothing", async () => {
    db.referralCode.findUnique.mockResolvedValue({ id: "c1" });
    db.referralCode.findFirst.mockResolvedValue(null); // active: true filtered it
    expect(await referrerByPageToken(GOOD_TOKEN, NOW)).toBeNull();
    expect(db.referralCode.findFirst.mock.calls[0]![0].where).toMatchObject({
      kind: "CUSTOMER",
      active: true,
    });
  });

  it("is the plain 404 page, whatever the reason", async () => {
    db.referralCode.findUnique.mockResolvedValue(null);
    for (const token of ["nope", GOOD_TOKEN])
      await expect(
        ReferralsPage({ params: Promise.resolve({ token }) } as never),
      ).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});

describe("View my referrals from a deal", () => {
  it("needs the deal's own tracking token", async () => {
    findDealIdByToken.mockResolvedValue(null);
    expect(await referrerByDeal("SLZ-1087", "wrong", NOW)).toBeNull();
    expect(db.referralCode.findFirst).not.toHaveBeenCalled();
  });

  it("opens the code of that deal's own number only", async () => {
    findDealIdByToken.mockResolvedValue("d1");
    db.deal.findUnique.mockResolvedValue({
      customerWhatsapp: "+234 809 000 1111",
    });
    db.referralCode.findFirst
      .mockResolvedValueOnce({ id: "c1" })
      .mockResolvedValueOnce({ code: "SLZ7KQ4M", deals: [] });
    const view = await referrerByDeal("SLZ-1087", "tok", NOW);
    expect(view?.code).toBe("SLZ7KQ4M");
    expect(db.referralCode.findFirst.mock.calls[0]![0].where).toEqual({
      organizationId: "org1",
      kind: "CUSTOMER",
      customerWhatsapp: "+234 809 000 1111",
      active: true,
    });
  });
});

describe("the referrer's page", () => {
  it("reads only the deal ref, status, date and reward of referred deals", () => {
    expect(Object.keys(REFERRER_DEAL_SELECT).sort()).toEqual([
      "createdAt",
      "ref",
      "referralReward",
      "status",
    ]);
    expect(
      Object.keys(REFERRER_DEAL_SELECT.referralReward.select),
    ).not.toContain("profitNaira");
  });

  it("shows the code, campaign, totals and masked list, and no personal data", async () => {
    db.referralCode.findUnique.mockResolvedValue({ id: "c1" });
    db.referralCode.findFirst.mockResolvedValue({
      code: "SLZ7KQ4M",
      deals: [
        referred("SLZ-1087", "COMPLETED", reward("4500", "PAID")),
        referred("SLZ-1090", "COMPLETED", reward("3000", "PENDING")),
        referred("SLZ-1093", "PROCESSING", null),
      ],
    });
    const view = await referrerByPageToken(GOOD_TOKEN, NOW);
    expect(view).not.toBeNull();
    expect(view!.totals).toEqual({
      deals: 3,
      pending: "3000",
      approved: "0",
      paid: "4500",
    });
    expect(view!.campaign).toEqual({ pct: "15", endsOn: "2026-12-20" });
    expect(view!.shareUrl).toBe("https://stereolinkz.com/r/SLZ7KQ4M");

    const html = renderToStaticMarkup(
      createElement(ReferrerView, { view: view! }),
    );
    expect(html).toContain("SLZ-1087 · Completed · reward paid ₦4,500");
    expect(html).toContain("SLZ-1093 · In progress · no reward");
    expect(html).toContain("Active until 20 Dec 2026");
    expect(html).toContain("We pay rewards to the account you used");
    expect(html).toContain("wa.me/2348109783417");
    for (const value of [
      ...Object.values(PRIVATE),
      "Adaeze",
      "0199",
      "2,500",
    ]) {
      expect(JSON.stringify(view)).not.toContain(value);
      expect(html).not.toContain(value);
    }
  });

  it("says rewards resume when no campaign is running", async () => {
    campaignInForceNow.mockResolvedValue(null);
    db.referralCode.findUnique.mockResolvedValue({ id: "c1" });
    db.referralCode.findFirst.mockResolvedValue({
      code: "SLZ7KQ4M",
      deals: [],
    });
    const view = await referrerByPageToken(GOOD_TOKEN, NOW);
    const html = renderToStaticMarkup(
      createElement(ReferrerView, { view: view! }),
    );
    expect(html).toContain(
      "No active campaign: links still work, rewards resume when the next campaign starts.",
    );
  });
});
