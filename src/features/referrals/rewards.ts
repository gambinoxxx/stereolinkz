import "server-only";

// Rewards and customer codes, at the moment a deal reaches COMPLETED or
// PAID_OUT, in the same transaction as the status change:
// 1. our profit is logged (entered by the team; required with a code);
// 2. if the deal carries a referral, a PENDING reward of the campaign's
//    bps of that profit, rounded down, held for the hold period (and to
//    next month past the referrer's cap), unless the referred customer
//    already earned one (FIRST_DEAL_ONLY) or the profit is 0 or less;
// 3. the deal's own customer gets a referral code of their own if their
//    number has none yet (and a private page token, shown once).
import { randomBytes } from "node:crypto";

import { z } from "zod";

import { nameCheck } from "@/features/crypto-deposits/names";
import { nairaText } from "@/features/deals/format";
import { createTrackingToken } from "@/features/deals/security";
import {
  bpsToPct,
  CAP_FLAG_NOTE,
  customerCodeFrom,
  FIRST_DEAL_ONLY,
  passesCap,
  referrerKey,
  rewardAmount,
  rewardFromBps,
  SELF_REFERRAL_FLAG,
} from "@/features/referrals/rules";
import type { Prisma } from "@/generated/prisma/client";
import { isDecimalString } from "@/lib/decimal";
import { formatBoardDate, monthInTimeZone } from "@/lib/format";

// "Our profit on this deal" (₦, 0 or more). Empty → not entered.
export const profitField = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim().replace(/[,₦\s]/g, ""))
  .pipe(
    z
      .string()
      .refine(
        (v) => v === "" || (isDecimalString(v) && !v.startsWith("-")),
        "Enter our profit in naira, like 45000 (0 if none).",
      ),
  )
  .transform((v) => (v === "" ? null : v));

// The message lives in rules.ts so the admin panels can show it too.
export { PROFIT_REQUIRED } from "@/features/referrals/rules";

type Tx = Prisma.TransactionClient;

// A customer code created by this completion: the page token exists only
// here (only its hash is stored), so the caller can email the link once.
export type NewCustomerCode = { code: string; pageToken: string } | null;

export async function recordProfitAndReward(
  tx: Tx,
  input: {
    dealId: string;
    profit: string | null;
    membershipId: string;
    now?: Date;
  },
): Promise<NewCustomerCode> {
  const { profit, membershipId } = input;
  const now = input.now ?? new Date();
  const event = (
    type: "PROFIT_RECORDED" | "REFERRAL",
    message: string,
    data: Prisma.InputJsonValue,
    offsetMs: number,
  ) =>
    tx.dealEvent.create({
      data: {
        dealId: input.dealId,
        type,
        message,
        data,
        actorType: "MEMBER",
        actorMembershipId: membershipId,
        createdAt: new Date(now.getTime() + offsetMs),
      },
    });

  if (profit !== null)
    await event(
      "PROFIT_RECORDED",
      `Our profit on this deal: ${nairaText(profit)}`,
      { profitNaira: profit },
      1,
    );

  const deal = await tx.deal.findUniqueOrThrow({
    where: { id: input.dealId },
    select: {
      id: true,
      ref: true,
      service: true,
      organizationId: true,
      customerName: true,
      customerWhatsapp: true,
      payoutAccountName: true,
      referralCampaign: { select: { id: true, rewardBps: true } },
      referralCode: {
        select: {
          id: true,
          code: true,
          kind: true,
          membershipId: true,
          customerWhatsapp: true,
          customerName: true,
        },
      },
      organization: {
        select: {
          timezone: true,
          referralRewardPct: true,
          referralHoldDays: true,
          referralMonthlyCapNaira: true,
        },
      },
    },
  });

  const code = deal.referralCode;
  if (code && profit !== null) {
    const org = deal.organization;
    const campaign = deal.referralCampaign;
    // Campaign deals use its bps; a Stage A deal (no campaign) the org's %.
    const bps = campaign
      ? campaign.rewardBps
      : Math.round(Number(org.referralRewardPct.toFixed()) * 100);
    const pct = bpsToPct(bps);
    const amount = campaign
      ? rewardFromBps(profit, bps)
      : rewardAmount(profit, org.referralRewardPct.toFixed());
    const earlier = FIRST_DEAL_ONLY
      ? await tx.referralReward.count({
          where: {
            organizationId: deal.organizationId,
            status: { not: "VOID" },
            deal: { customerWhatsapp: deal.customerWhatsapp },
          },
        })
      : 0;
    if (earlier > 0)
      await event(
        "REFERRAL",
        `No referral reward for ${code.code}: only the customer’s first deal earns one`,
        { code: code.code, amountNaira: "0" },
        2,
      );
    else if (amount === "0")
      await event(
        "REFERRAL",
        `No referral reward for ${code.code}: ${pct}% of ${nairaText(profit)} is under ₦1`,
        { code: code.code, amountNaira: "0" },
        2,
      );
    else {
      // One referrer at a time, so two completions can't both slip under
      // the monthly cap.
      const key = referrerKey(code);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${deal.organizationId}:${key}`}))`;
      const month = monthInTimeZone(now, org.timezone);
      const cap = org.referralMonthlyCapNaira?.toFixed() ?? null;
      const total = cap
        ? await tx.referralReward.aggregate({
            where: {
              organizationId: deal.organizationId,
              referrerKey: key,
              status: { in: ["APPROVED", "PAID"] },
              approvedAt: { gte: month.start, lt: month.end },
            },
            _sum: { amountNaira: true },
          })
        : null;
      const capped = passesCap(
        cap,
        total?._sum.amountNaira?.toFixed() ?? "0",
        amount,
      );
      // A customer code whose owner is paid out to their own account
      // name: possibly themselves on another number. Held for a check.
      const flag =
        code.kind === "CUSTOMER" &&
        code.customerName &&
        deal.payoutAccountName &&
        nameCheck(code.customerName, deal.payoutAccountName) === "MATCH"
          ? SELF_REFERRAL_FLAG
          : null;
      const holdUntil = new Date(
        now.getTime() + org.referralHoldDays * 24 * 60 * 60_000,
      );
      await tx.referralReward.create({
        data: {
          organizationId: deal.organizationId,
          dealId: deal.id,
          codeId: code.id,
          referrerKey: key,
          code: code.code,
          dealRef: deal.ref,
          service: deal.service,
          pct,
          rewardBps: bps,
          campaignId: campaign?.id ?? null,
          profitNaira: profit,
          amountNaira: amount,
          holdUntil,
          notBefore: capped ? month.end : null,
          flag,
          createdAt: now,
        },
      });
      const until = formatBoardDate(holdUntil, org.timezone);
      await event(
        "REFERRAL",
        `Referral reward for ${code.code}: ${nairaText(amount)} (${pct}% of our ${nairaText(profit)} profit), pending until ${until}` +
          (capped
            ? `. ${CAP_FLAG_NOTE}: can be approved from ${formatBoardDate(month.end, org.timezone)}`
            : "") +
          (flag ? `. ${flag}` : ""),
        { code: code.code, amountNaira: amount, capped, flagged: !!flag },
        2,
      );
    }
  }

  return ensureCustomerCode(tx, {
    organizationId: deal.organizationId,
    dealId: deal.id,
    customerWhatsapp: deal.customerWhatsapp,
    customerName: deal.customerName,
    membershipId,
    now,
  });
}

// The customer's own code, made once per number. Two completions at once
// queue on a per-number lock; a code that happens to be taken already is
// drawn again (ON CONFLICT, so the clash never aborts the transaction).
export async function ensureCustomerCode(
  tx: Tx,
  input: {
    organizationId: string;
    dealId: string;
    customerWhatsapp: string;
    customerName: string;
    membershipId: string | null;
    now: Date;
  },
): Promise<NewCustomerCode> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`code:${input.organizationId}:${input.customerWhatsapp}`}))`;
  const existing = await tx.referralCode.findFirst({
    where: {
      organizationId: input.organizationId,
      kind: "CUSTOMER",
      customerWhatsapp: input.customerWhatsapp,
      active: true,
    },
    select: { id: true },
  });
  if (existing) return null;
  const { token, hash } = createTrackingToken();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = customerCodeFrom(randomBytes(16));
    if (!code) continue;
    const inserted = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "ReferralCode" ("id", "organizationId", "code", "kind", "customerWhatsapp", "customerName", "firstDealId", "pageTokenHash", "pageTokenAt", "active", "createdAt")
      VALUES (${`rc_${randomBytes(12).toString("hex")}`}, ${input.organizationId}, ${code}, 'CUSTOMER', ${input.customerWhatsapp}, ${input.customerName}, ${input.dealId}, ${hash}, ${input.now}, true, ${input.now})
      ON CONFLICT DO NOTHING
      RETURNING "id"`;
    if (inserted.length === 1) {
      await tx.dealEvent.create({
        data: {
          dealId: input.dealId,
          type: "REFERRAL",
          message: `The customer’s own referral code: ${code}`,
          data: { customerCode: code },
          actorType: input.membershipId ? "MEMBER" : "SYSTEM",
          actorMembershipId: input.membershipId,
          createdAt: new Date(input.now.getTime() + 3),
        },
      });
      return { code, pageToken: token };
    }
  }
  throw new Error("Could not draw a free referral code");
}
