// Referral attribution end to end on a DEVELOPMENT database: the link's
// cookie → submit → attach → completion (both paths) → reward → ledger,
// and every skip reason logged on the deal and shown to the team. Opt-in:
// DEAL_DB_TESTS=1 npx vitest run src/features/referrals/attribution.db.test.ts
// Runs its own campaign, staff code and deals; all deleted afterwards.
import { randomBytes } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

config({ path: [".env.local"], quiet: true });

const PROD_HOST = "ep-twilight-brook";
const enabled =
  process.env.DEAL_DB_TESTS === "1" &&
  !!process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes(PROD_HOST);

// The team member the real actions run as (set in beforeAll).
const member = {
  userId: "test",
  membershipId: "",
  organizationId: "",
  role: "OWNER" as const,
};
vi.mock("@/lib/server/auth", () => ({ requireMember: async () => member }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: () => {},
}));

describe.skipIf(!enabled)(
  "referral attribution on the database",
  { timeout: 240_000 },
  async () => {
    const { db } = await import("@/lib/server/db");
    const { createDeal } = await import("@/features/deals/create");
    const { referralForSubmit } = await import("@/features/referrals/link");
    const { markDealCompleted } = await import("@/features/deals/actions");
    const { markPaidOut } = await import("@/features/crypto-deposits/actions");
    const { getDealReferral, getLedger, listStaffCodes } =
      await import("@/features/referrals/queries");
    const { PROFIT_REQUIRED } = await import("@/features/referrals/rules");

    let campaignId = "";
    let codeId = "";
    let accountId = "";
    let pausedCampaign: string | null = null;
    let savedWhatsapp: string | null = null;
    const deals: string[] = [];
    const phones: string[] = [];
    const tag = randomBytes(2).toString("hex").toUpperCase();
    const CODE = `QB${tag}`;
    const phone = () => {
      const n = `81${Math.floor(10000000 + Math.random() * 89999999)}`;
      const p = `+234 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
      phones.push(p);
      return p;
    };
    const staffNumber = phone();

    // A website deal: `typed` is the form's field (undefined: hidden),
    // `cookie` the link's cookie.
    const submit = async (
      whatsapp: string,
      typed: string | undefined,
      cookie: string | undefined,
    ) => {
      const r = await referralForSubmit(member.organizationId, typed, cookie);
      if (!r.ok) return { error: r.error };
      const d = await createDeal({
        organizationId: member.organizationId,
        service: "POF",
        customer: { name: "Test Customer", whatsapp },
        details: { service: "POF" } as never,
        currency: "NGN",
        amount: "1000000",
        quote: null,
        ownerMembershipId: null,
        trackingTokenHash: "0".repeat(64),
        ipHash: null,
        actor: { type: "CUSTOMER" },
        message: "Requested on the website",
        referral: r.referral,
      });
      deals.push(d.id);
      return d;
    };
    const created = async (...a: Parameters<typeof submit>) => {
      const d = await submit(...a);
      if ("error" in d) throw new Error(d.error);
      return d;
    };
    const outcome = async (dealId: string) =>
      (await getDealReferral(dealId))!.outcome;
    const setStatus = (id: string, status: "PAYMENT_RECEIVED") =>
      db.deal.update({ where: { id }, data: { status } });
    const setCampaign = (active: boolean) =>
      db.referralCampaign.update({
        where: { id: campaignId },
        data: { active },
      });

    beforeAll(async () => {
      const org = await db.organization.findFirstOrThrow({
        select: { id: true },
      });
      member.organizationId = org.id;
      const active = await db.referralCampaign.findFirst({
        where: { organizationId: org.id, active: true },
        select: { id: true },
      });
      if (active) {
        pausedCampaign = active.id;
        await db.referralCampaign.update({
          where: { id: active.id },
          data: { active: false },
        });
      }
      campaignId = (
        await db.referralCampaign.create({
          data: {
            organizationId: org.id,
            name: `QA ${tag}`,
            startsAt: new Date(Date.now() - 60_000),
            endsAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
            active: true,
            rewardBps: 1500,
          },
        })
      ).id;
      const m = await db.membership.findFirstOrThrow({
        where: { organizationId: org.id, role: "OWNER" },
        select: { id: true, whatsapp: true },
      });
      member.membershipId = m.id;
      savedWhatsapp = m.whatsapp;
      await db.membership.update({
        where: { id: m.id },
        data: { whatsapp: staffNumber },
      });
      codeId = (
        await db.referralCode.create({
          data: {
            organizationId: org.id,
            code: CODE,
            kind: "STAFF",
            membershipId: m.id,
          },
        })
      ).id;
      accountId = (
        await db.paymentAccount.findFirstOrThrow({
          where: { organizationId: org.id },
          select: { id: true },
        })
      ).id;
    }, 60_000);

    afterAll(async () => {
      await db.referralReward.deleteMany({ where: { dealId: { in: deals } } });
      await db.referralCode.deleteMany({
        where: { kind: "CUSTOMER", customerWhatsapp: { in: phones } },
      });
      await db.deal.deleteMany({ where: { id: { in: deals } } });
      await db.referralCode.deleteMany({ where: { id: codeId } });
      await db.referralCampaign.deleteMany({ where: { id: campaignId } });
      if (pausedCampaign)
        await db.referralCampaign.update({
          where: { id: pausedCampaign },
          data: { active: true },
        });
      await db.membership.update({
        where: { id: member.membershipId },
        data: { whatsapp: savedWhatsapp },
      });
      await db.$disconnect();
    }, 60_000);

    it("link cookie → submit → attach → Mark completed (profit required) → PENDING reward in the ledger", async () => {
      // The field was hidden (a cached form): the cookie's code still counts.
      const d = await created(phone(), undefined, CODE);
      expect(await outcome(d.id)).toEqual({ attached: true, code: CODE });
      await setStatus(d.id, "PAYMENT_RECEIVED");

      const refused = await markDealCompleted({ ref: d.ref, profit: "" });
      expect(refused).toMatchObject({ ok: false, error: PROFIT_REQUIRED });
      expect(
        (await db.deal.findUniqueOrThrow({ where: { id: d.id } })).status,
      ).toBe("PAYMENT_RECEIVED");

      expect(await markDealCompleted({ ref: d.ref, profit: "30000" })).toEqual({
        ok: true,
        data: { status: "COMPLETED" },
      });
      const reward = await db.referralReward.findUniqueOrThrow({
        where: { dealId: d.id },
      });
      expect(reward.amountNaira.toFixed()).toBe("4500");
      expect(reward.status).toBe("PENDING");

      const ledger = await getLedger(member.organizationId, {
        status: "PENDING",
      });
      const row = ledger.rows.find((r) => r.dealRef === d.ref);
      expect(row?.readyOn).toBe(reward.holdUntil.toISOString());
      expect(ledger.counts.PENDING).toBeGreaterThan(0);
    });

    it("crypto: Mark paid out refuses no profit, then records the reward", async () => {
      const d = await created(phone(), CODE, undefined);
      await db.deal.update({
        where: { id: d.id },
        data: { service: "CRYPTO_SELL", status: "DEPOSIT_COMPLETE" },
      });
      // Crypto only counts when the campaign includes it.
      await db.deal.update({
        where: { id: d.id },
        data: { referralCodeId: codeId },
      });
      const pay = (profit: string) =>
        markPaidOut({
          ref: d.ref,
          reference: "QA-REF-1",
          paidFromAccountId: accountId,
          profit,
        });
      expect(await pay("")).toMatchObject({
        ok: false,
        error: PROFIT_REQUIRED,
      });
      expect(await pay("20000")).toEqual({
        ok: true,
        data: { status: "PAID_OUT" },
      });
      const reward = await db.referralReward.findUniqueOrThrow({
        where: { dealId: d.id },
      });
      expect(reward.amountNaira.toFixed()).toBe("3000");
    });

    it("logs and shows every skip reason", async () => {
      // Own number.
      const own = await created(staffNumber, CODE, undefined);
      expect(await outcome(own.id)).toMatchObject({
        attached: false,
        code: CODE,
        reason: "staff_own_number",
      });
      // Not a new customer (the first test's customer completed a deal).
      const returning = phone();
      const first = await created(returning, undefined, undefined);
      await db.deal.update({
        where: { id: first.id },
        data: { status: "COMPLETED" },
      });
      const again = await created(returning, CODE, undefined);
      expect(await outcome(again.id)).toMatchObject({
        reason: "not_new_customer",
      });
      // Unknown and inactive codes from the cookie never block the deal.
      const unknown = await created(phone(), undefined, "NOPE9999");
      expect(await outcome(unknown.id)).toMatchObject({
        code: "NOPE9999",
        reason: "unknown_code",
      });
      await db.referralCode.update({
        where: { id: codeId },
        data: { active: false },
      });
      try {
        const inactive = await created(phone(), undefined, CODE);
        expect(await outcome(inactive.id)).toMatchObject({
          reason: "inactive_code",
        });
        // …but a TYPED one is the customer's field error.
        expect(await submit(phone(), CODE, undefined)).toHaveProperty("error");
      } finally {
        await db.referralCode.update({
          where: { id: codeId },
          data: { active: true },
        });
      }
      // No campaign: the field is hidden; the cookie's outcome is logged.
      await setCampaign(false);
      try {
        const off = await created(phone(), undefined, CODE);
        expect(await outcome(off.id)).toMatchObject({
          code: CODE,
          reason: "no_campaign",
        });
      } finally {
        await setCampaign(true);
      }
      // Service not in the campaign (crypto, not included).
      const r = await referralForSubmit(member.organizationId, CODE, undefined);
      if (!r.ok) throw new Error(r.error);
      const crypto = await db.$transaction(
        async (tx) => {
          const { decideAttach } = await import("@/features/referrals/attach");
          return decideAttach(tx, {
            organizationId: member.organizationId,
            code: (r.referral as { code: never }).code,
            customerWhatsapp: phone(),
            service: "CRYPTO_SELL",
            now: new Date(),
          });
        },
        { maxWait: 10_000, timeout: 15_000 },
      );
      expect(crypto).toMatchObject({
        attach: false,
        reason: "service_not_eligible",
      });
      // No code at all; and a field the customer emptied, even with a cookie.
      const none = await created(phone(), undefined, undefined);
      expect(await outcome(none.id)).toMatchObject({ reason: "no_code" });
      const emptied = await created(phone(), "", CODE);
      expect(await outcome(emptied.id)).toMatchObject({ reason: "no_code" });

      // Settings → Referrals: deals that came with the code, and attached.
      const staff = (await listStaffCodes(member.organizationId)).find(
        (c) => c.code === CODE,
      )!;
      // Attached: the two deals of the tests above. Used: those, plus own
      // number, returning, inactive (cookie) and no campaign; the typed
      // inactive code made no deal.
      expect(staff.deals).toBe(2);
      expect(staff.used).toBe(6);
    });
  },
);
