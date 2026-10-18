// The referral programme on a DEVELOPMENT database (Phase 13c). Opt-in:
// DEAL_DB_TESTS=1 npx vitest run src/features/referrals/referrals.db.test.ts
// Switches the first org's programme on for the run and puts every setting
// back afterwards; its own deals, codes and rewards are deleted.
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
  { timeout: 120_000 },
  async () => {
    const { db } = await import("@/lib/server/db");
    const { createDeal } = await import("@/features/deals/create");
    const { checkCode } = await import("@/features/referrals/attach");
    const { recordProfitAndReward } =
      await import("@/features/referrals/rewards");
    const { transitionDeal } = await import("@/features/deals/transitions");

    let organizationId = "";
    let membershipId = "";
    let codeId = "";
    let saved: Record<string, unknown> = {};
    let savedWhatsapp: string | null = null;
    const deals: string[] = [];
    const tag = randomBytes(2).toString("hex").toUpperCase();
    const CODE = `QA${tag}`;
    const staffNumber = `+23480${Math.floor(10000000 + Math.random() * 89999999)}`;
    const phone = () =>
      `+23481${Math.floor(10000000 + Math.random() * 89999999)}`;

    const newDeal = async (whatsapp: string, withCode = true) => {
      const check = await checkCode(organizationId, CODE, "POF", new Date());
      if (!check.ok) throw new Error(check.error);
      const d = await createDeal({
        organizationId,
        service: "POF",
        customer: { name: "Test Customer", whatsapp },
        details: {
          service: "POF",
          purpose: "STUDY_VISA",
          months: 3,
          bankId: null,
          destinationCountry: "UK",
        } as never,
        currency: "NGN",
        amount: "1000000",
        quote: null,
        ownerMembershipId: null,
        trackingTokenHash: "0".repeat(64),
        ipHash: null,
        actor: { type: "CUSTOMER" },
        message: "Requested on the website",
        referral:
          withCode && check.code
            ? { code: check.code, newCustomersOnly: true }
            : undefined,
      });
      deals.push(d.id);
      return d;
    };

    // Moves a deal to COMPLETED with our profit, the way markDealCompleted
    // does: status and profit together, then the reward, one transaction.
    const complete = async (dealId: string, profit: string, now?: Date) => {
      await db.deal.update({
        where: { id: dealId },
        data: { status: "PAYMENT_RECEIVED" },
      });
      await db.$transaction(async (tx) => {
        await transitionDeal(
          tx,
          { id: dealId, status: "PAYMENT_RECEIVED" },
          "COMPLETED",
          { type: "MEMBER", membershipId },
          { message: "Deal completed", set: { profitNaira: profit }, now },
        );
        await recordProfitAndReward(tx, {
          dealId,
          profit,
          membershipId,
          now,
        });
      });
    };

    beforeAll(async () => {
      const org = await db.organization.findFirstOrThrow({
        select: {
          id: true,
          referralEnabled: true,
          referralStartsAt: true,
          referralEndsAt: true,
          referralRewardPct: true,
          referralHoldDays: true,
          referralNewCustomersOnly: true,
          referralMonthlyCapNaira: true,
          referralServices: true,
        },
      });
      organizationId = org.id;
      const { id: _id, ...rest } = org;
      void _id;
      saved = rest;
      await db.organization.update({
        where: { id: organizationId },
        data: {
          referralEnabled: true,
          referralStartsAt: new Date(Date.now() - 60_000),
          referralEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
          referralRewardPct: "15",
          referralHoldDays: 7,
          referralNewCustomersOnly: true,
          referralMonthlyCapNaira: null,
          referralServices: ["POF", "FOREX_SELL"],
        },
      });
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
    });

    afterAll(async () => {
      await db.referralReward.deleteMany({ where: { dealId: { in: deals } } });
      await db.deal.deleteMany({ where: { id: { in: deals } } });
      await db.referralCode.deleteMany({ where: { id: codeId } });
      await db.membership.update({
        where: { id: membershipId },
        data: { whatsapp: savedWhatsapp },
      });
      await db.organization.update({
        where: { id: organizationId },
        data: saved as never,
      });
      await db.$disconnect();
    });

    it("attaches a staff code to a new customer's deal and logs it", async () => {
      const d = await newDeal(phone());
      const row = await db.deal.findUniqueOrThrow({
        where: { id: d.id },
        select: {
          referralCodeId: true,
          events: { select: { type: true, message: true } },
        },
      });
      expect(row.referralCodeId).toBe(codeId);
      expect(row.events.map((e) => e.message)).toContain(
        `Referral code ${CODE} applied`,
      );
    });

    it("ignores the code when the programme is off or for another service", async () => {
      expect(
        (await checkCode(organizationId, CODE, "CRYPTO_SELL", new Date())).ok,
      ).toBe(true);
      expect(
        await checkCode(organizationId, CODE, "CRYPTO_SELL", new Date()),
      ).toEqual({ ok: true, code: null });
      expect(
        await checkCode(
          organizationId,
          CODE,
          "POF",
          new Date(Date.now() + 60 * 24 * 60 * 60_000), // after the window
        ),
      ).toEqual({ ok: true, code: null });
      expect(
        (await checkCode(organizationId, "NOSUCH1", "POF", new Date())).ok,
      ).toBe(false);
    });

    it("never attaches a staff code to the staff member's own number", async () => {
      const d = await newDeal(staffNumber);
      const row = await db.deal.findUniqueOrThrow({
        where: { id: d.id },
        select: { referralCodeId: true, events: { select: { message: true } } },
      });
      expect(row.referralCodeId).toBeNull();
      expect(row.events.map((e) => e.message).join(" ")).toContain(
        "own WhatsApp number",
      );
    });

    it("only counts new customers", async () => {
      const returning = phone();
      const first = await newDeal(returning, false);
      await complete(first.id, "1000");
      const second = await newDeal(returning);
      const row = await db.deal.findUniqueOrThrow({
        where: { id: second.id },
        select: { referralCodeId: true, events: { select: { message: true } } },
      });
      expect(row.referralCodeId).toBeNull();
      expect(row.events.map((e) => e.message).join(" ")).toContain(
        "completed a deal with us before",
      );
    });

    it("creates a PENDING reward of 15% of our profit, rounded down", async () => {
      const d = await newDeal(phone());
      const now = new Date();
      await complete(d.id, "12345.67", now);
      const r = await db.referralReward.findUniqueOrThrow({
        where: { dealId: d.id },
      });
      expect(r.amountNaira.toFixed()).toBe("1851");
      expect(r.pct.toFixed()).toBe("15");
      expect(r.profitNaira.toFixed()).toBe("12345.67");
      expect(r.status).toBe("PENDING");
      expect(r.code).toBe(CODE);
      expect(r.holdUntil.getTime()).toBe(now.getTime() + 7 * 24 * 60 * 60_000);
      expect(r.notBefore).toBeNull();
    });

    it("holds a reward over the monthly cap until next month", async () => {
      await db.organization.update({
        where: { id: organizationId },
        data: { referralMonthlyCapNaira: "2000" },
      });
      try {
        const a = await newDeal(phone());
        await complete(a.id, "10000"); // ₦1,500
        await db.referralReward.update({
          where: { dealId: a.id },
          data: { status: "APPROVED", approvedAt: new Date() },
        });
        const b = await newDeal(phone());
        await complete(b.id, "10000"); // another ₦1,500 → past ₦2,000
        const r = await db.referralReward.findUniqueOrThrow({
          where: { dealId: b.id },
        });
        expect(r.notBefore).not.toBeNull();
        expect(r.notBefore!.getTime()).toBeGreaterThan(Date.now());
      } finally {
        await db.organization.update({
          where: { id: organizationId },
          data: { referralMonthlyCapNaira: null },
        });
      }
    });

    it("locks the code, the profit and the reward's snapshot", async () => {
      const d = await newDeal(phone());
      await complete(d.id, "5000");
      await expect(
        db.deal.update({ where: { id: d.id }, data: { referralCodeId: null } }),
      ).rejects.toThrow(/deal_referral_locked/);
      await expect(
        db.deal.update({ where: { id: d.id }, data: { profitNaira: "6000" } }),
      ).rejects.toThrow(/deal_referral_locked/);
      await expect(
        db.referralReward.update({
          where: { dealId: d.id },
          data: { amountNaira: "999999" },
        }),
      ).rejects.toThrow(/referral_reward_guard/);
      // PENDING → PAID skips approval: refused.
      await expect(
        db.referralReward.update({
          where: { dealId: d.id },
          data: { status: "PAID", paidAt: new Date(), bankReference: "X1" },
        }),
      ).rejects.toThrow(/referral_reward_guard/);
      // VOID is final.
      await db.referralReward.update({
        where: { dealId: d.id },
        data: { status: "VOID", voidedAt: new Date(), voidReason: "Test" },
      });
      await expect(
        db.referralReward.update({
          where: { dealId: d.id },
          data: { status: "APPROVED", approvedAt: new Date() },
        }),
      ).rejects.toThrow(/referral_reward_guard/);
    });

    it("gives one reward per deal", async () => {
      const d = await newDeal(phone());
      await complete(d.id, "5000");
      const r = await db.referralReward.findUniqueOrThrow({
        where: { dealId: d.id },
      });
      await expect(
        db.referralReward.create({
          data: {
            organizationId,
            dealId: d.id,
            codeId,
            referrerKey: r.referrerKey,
            code: CODE,
            dealRef: r.dealRef,
            service: "POF",
            pct: "15",
            profitNaira: "1",
            amountNaira: "0",
            holdUntil: new Date(),
          },
        }),
      ).rejects.toThrow();
    });
  },
);
