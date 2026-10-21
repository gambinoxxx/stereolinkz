// Referrals on a DEVELOPMENT database. Opt-in:
// DEAL_DB_TESTS=1 npx vitest run src/features/referrals/referrals.db.test.ts
// Runs its own campaign (any active one is switched off for the run and
// back on after), staff code and deals; all deleted afterwards.
import { randomBytes } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: [".env.local"], quiet: true });

const PROD_HOST = "ep-twilight-brook";
const enabled =
  process.env.DEAL_DB_TESTS === "1" &&
  !!process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes(PROD_HOST);

describe.skipIf(!enabled)(
  "referrals on the database",
  { timeout: 180_000 },
  async () => {
    const { db } = await import("@/lib/server/db");
    const { createDeal } = await import("@/features/deals/create");
    const { checkCode, decideAttach, CODE_NOT_FOUND } =
      await import("@/features/referrals/attach");
    const { recordProfitAndReward } =
      await import("@/features/referrals/rewards");
    const { transitionDeal } = await import("@/features/deals/transitions");
    const { CUSTOMER_CODE_PATTERN } =
      await import("@/features/referrals/rules");

    let organizationId = "";
    let membershipId = "";
    let codeId = "";
    let campaignId = "";
    let pausedCampaign: string | null = null;
    let savedWhatsapp: string | null = null;
    let savedHold = 7;
    let savedCap: unknown = null;
    const deals: string[] = [];
    const phones: string[] = [];
    const tag = randomBytes(2).toString("hex").toUpperCase();
    const CODE = `QA${tag}`;
    const phone = () => {
      const n = `81${Math.floor(10000000 + Math.random() * 89999999)}`;
      const p = `+234 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
      phones.push(p);
      return p;
    };
    const staffNumber = phone();

    const newDeal = async (whatsapp: string, withCode = true) => {
      const check = await checkCode(organizationId, withCode ? CODE : "");
      if (!check.ok) throw new Error(check.error);
      const d = await createDeal({
        organizationId,
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
        referral: check.code ? { code: check.code } : undefined,
      });
      deals.push(d.id);
      return d;
    };
    const row = (id: string) =>
      db.deal.findUniqueOrThrow({
        where: { id },
        select: {
          referralCodeId: true,
          referralCampaignId: true,
          events: { select: { message: true } },
        },
      });

    // COMPLETED with our profit, the way markDealCompleted does it.
    const complete = (dealId: string, profit: string | null) =>
      db.$transaction(
        async (tx) => {
          await tx.deal.update({
            where: { id: dealId },
            data: { status: "PAYMENT_RECEIVED" },
          });
          await transitionDeal(
            tx,
            { id: dealId, status: "PAYMENT_RECEIVED" },
            "COMPLETED",
            { type: "MEMBER", membershipId },
            {
              message: "Deal completed",
              set: profit === null ? undefined : { profitNaira: profit },
            },
          );
          return recordProfitAndReward(tx, {
            dealId,
            profit,
            membershipId,
          });
        },
        { maxWait: 10_000, timeout: 15_000 },
      );

    beforeAll(async () => {
      const org = await db.organization.findFirstOrThrow({
        select: {
          id: true,
          referralHoldDays: true,
          referralMonthlyCapNaira: true,
        },
      });
      organizationId = org.id;
      savedHold = org.referralHoldDays;
      savedCap = org.referralMonthlyCapNaira;
      await db.organization.update({
        where: { id: organizationId },
        data: { referralHoldDays: 7, referralMonthlyCapNaira: null },
      });
      const active = await db.referralCampaign.findFirst({
        where: { organizationId, active: true },
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
            organizationId,
            name: `QA ${tag}`,
            startsAt: new Date(Date.now() - 60_000),
            endsAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
            active: true,
            rewardBps: 1500,
          },
        })
      ).id;
      const m = await db.membership.findFirstOrThrow({
        where: { organizationId },
        select: { id: true, whatsapp: true },
      });
      membershipId = m.id;
      savedWhatsapp = m.whatsapp;
      await db.membership.update({
        where: { id: membershipId },
        data: { whatsapp: staffNumber },
      });
      codeId = (
        await db.referralCode.create({
          data: { organizationId, code: CODE, kind: "STAFF", membershipId },
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
        where: { id: membershipId },
        data: { whatsapp: savedWhatsapp },
      });
      await db.organization.update({
        where: { id: organizationId },
        data: {
          referralHoldDays: savedHold,
          referralMonthlyCapNaira: savedCap as never,
        },
      });
      await db.$disconnect();
    }, 60_000);

    it("attaches a code to a new customer's deal, with the campaign", async () => {
      const d = await newDeal(phone());
      const r = await row(d.id);
      expect(r.referralCodeId).toBe(codeId);
      expect(r.referralCampaignId).toBe(campaignId);
      expect(r.events.map((e) => e.message)).toContain(
        `Referral code ${CODE} applied`,
      );
    });

    it("refuses an unknown or inactive typed code with the friendly error", async () => {
      expect(await checkCode(organizationId, "NOPE9999")).toEqual({
        ok: false,
        error: CODE_NOT_FOUND,
      });
      expect(await checkCode(organizationId, "not a code!")).toEqual({
        ok: false,
        error: CODE_NOT_FOUND,
      });
      expect(await checkCode(organizationId, "")).toEqual({
        ok: true,
        code: null,
      });
    });

    it("applies the other rules silently: no campaign, own number, returning customer, crypto", async () => {
      const check = await checkCode(organizationId, CODE);
      if (!check.ok || !check.code) throw new Error("code");
      const decide = (whatsapp: string, service: "POF" | "CRYPTO_SELL") =>
        db.$transaction(
          (tx) =>
            decideAttach(tx, {
              organizationId,
              code: check.code!,
              customerWhatsapp: whatsapp,
              service,
              now: new Date(),
            }),
          { maxWait: 10_000, timeout: 15_000 },
        );
      // Own number.
      expect((await decide(staffNumber, "POF")).message).toContain(
        "own WhatsApp number",
      );
      // Crypto, without includeCrypto.
      expect((await decide(phone(), "CRYPTO_SELL")).message).toContain(
        "isn’t part of the campaign",
      );
      // Returning customer.
      const returning = phone();
      const first = await newDeal(returning, false);
      await complete(first.id, "1000");
      expect((await decide(returning, "POF")).message).toContain(
        "completed a deal with us before",
      );
      // No campaign.
      await db.referralCampaign.update({
        where: { id: campaignId },
        data: { active: false },
      });
      try {
        const d = await newDeal(phone());
        const r = await row(d.id);
        expect(r.referralCodeId).toBeNull();
        expect(r.events.map((e) => e.message).join(" ")).toContain(
          "no referral campaign is running",
        );
      } finally {
        await db.referralCampaign.update({
          where: { id: campaignId },
          data: { active: true },
        });
      }
      // Deactivated between the form and the insert.
      await db.referralCode.update({
        where: { id: codeId },
        data: { active: false },
      });
      try {
        expect((await decide(phone(), "POF")).message).toContain(
          "the code isn’t active",
        );
      } finally {
        await db.referralCode.update({
          where: { id: codeId },
          data: { active: true },
        });
      }
    });

    it("creates a PENDING reward of the campaign's bps, rounded down, and keeps it if the campaign changes", async () => {
      const d = await newDeal(phone());
      await complete(d.id, "12345.67");
      const r = await db.referralReward.findUniqueOrThrow({
        where: { dealId: d.id },
      });
      expect(r.amountNaira.toFixed()).toBe("1851");
      expect(r.rewardBps).toBe(1500);
      expect(r.campaignId).toBe(campaignId);
      expect(r.status).toBe("PENDING");
      await db.referralCampaign.update({
        where: { id: campaignId },
        data: { rewardBps: 2000 },
      });
      const again = await db.referralReward.findUniqueOrThrow({
        where: { dealId: d.id },
      });
      expect(again.amountNaira.toFixed()).toBe("1851");
      expect(again.rewardBps).toBe(1500);
      await db.referralCampaign.update({
        where: { id: campaignId },
        data: { rewardBps: 1500 },
      });
    });

    it("gives no reward for no profit", async () => {
      const d = await newDeal(phone());
      await complete(d.id, "0");
      expect(await db.referralReward.count({ where: { dealId: d.id } })).toBe(
        0,
      );
    });

    it("rewards only the referred customer's first deal", async () => {
      const p = phone();
      const a = await newDeal(p);
      const b = await newDeal(p); // both open, both carry the code
      expect((await row(b.id)).referralCodeId).toBe(codeId);
      await complete(a.id, "10000");
      await complete(b.id, "10000");
      expect(await db.referralReward.count({ where: { dealId: a.id } })).toBe(
        1,
      );
      expect(await db.referralReward.count({ where: { dealId: b.id } })).toBe(
        0,
      );
      expect(
        (await row(b.id)).events.map((e) => e.message).join(" "),
      ).toContain("only the customer’s first deal");
    });

    it("gives a completing customer one code of their own, even from two completions at once", async () => {
      const p = phone();
      const a = await newDeal(p, false);
      const b = await newDeal(p, false);
      const results = await Promise.all([
        complete(a.id, null),
        complete(b.id, null),
      ]);
      const codes = await db.referralCode.findMany({
        where: { organizationId, kind: "CUSTOMER", customerWhatsapp: p },
      });
      expect(codes).toHaveLength(1);
      expect(codes[0]!.code).toMatch(CUSTOMER_CODE_PATTERN);
      expect(codes[0]!.customerName).toBe("Test Customer");
      expect(codes[0]!.pageTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(results.filter(Boolean)).toHaveLength(1); // one token, once
      // A third completion later doesn't make another.
      const c = await newDeal(p, false);
      expect(await complete(c.id, null)).toBeNull();
    });

    it("lets a code be added only while NEW, removed any time, never swapped", async () => {
      const plain = await newDeal(phone(), false);
      const other = await db.referralCode.create({
        data: {
          organizationId,
          code: `QB${tag}`,
          kind: "STAFF",
          membershipId,
        },
      });
      try {
        // Added while NEW: allowed.
        await db.deal.update({
          where: { id: plain.id },
          data: { referralCodeId: codeId, referralCampaignId: campaignId },
        });
        // Swapped: refused.
        await expect(
          db.deal.update({
            where: { id: plain.id },
            data: { referralCodeId: other.id },
          }),
        ).rejects.toThrow(/never swapped/);
        // Removed, even after it moves on: allowed.
        await db.deal.update({
          where: { id: plain.id },
          data: { status: "AGREED" },
        });
        await db.deal.update({
          where: { id: plain.id },
          data: { referralCodeId: null, referralCampaignId: null },
        });
        // Added after NEW: refused.
        await expect(
          db.deal.update({
            where: { id: plain.id },
            data: { referralCodeId: codeId },
          }),
        ).rejects.toThrow(/only while the deal is NEW/);
      } finally {
        await db.referralCode.delete({ where: { id: other.id } });
      }
    });
  },
);
