import "server-only";

// Rewards (Phase 13c). When a deal reaches COMPLETED or PAID_OUT, the team
// enters our profit on it; if the deal carries a referral code, a reward
// of referralRewardPct % of that profit (rounded down) is created in the
// same transaction as the status change, PENDING for the hold period.
// Over the referrer's monthly cap, it waits for next month.
import { z } from "zod";

import { nairaText } from "@/features/deals/format";
import {
  CAP_FLAG_NOTE,
  passesCap,
  referrerKey,
  rewardAmount,
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

export const PROFIT_REQUIRED =
  "This deal has a referral code: enter our profit on it (0 if none).";

type Tx = Prisma.TransactionClient;

// After transitionDeal has set the status and profitNaira, in the same
// transaction: log the profit, and create the reward when there's a code.
export async function recordProfitAndReward(
  tx: Tx,
  input: {
    dealId: string;
    profit: string | null;
    membershipId: string;
    now?: Date;
  },
): Promise<void> {
  const { profit, membershipId } = input;
  if (profit === null) return;
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
      payoutAccountName: true,
      referralCode: {
        select: {
          id: true,
          code: true,
          kind: true,
          membershipId: true,
          customerWhatsapp: true,
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
  if (!code) return;
  const org = deal.organization;
  const pct = org.referralRewardPct.toFixed();
  const amount = rewardAmount(profit, pct);
  if (amount === "0") {
    await event(
      "REFERRAL",
      `No referral reward for ${code.code}: ${pct}% of ${nairaText(profit)} is under ₦1`,
      { code: code.code, amountNaira: "0" },
      2,
    );
    return;
  }

  // One referrer at a time, so two completions can't both slip under the
  // monthly cap.
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
      profitNaira: profit,
      amountNaira: amount,
      holdUntil,
      notBefore: capped ? month.end : null,
      createdAt: now,
    },
  });
  const until = formatBoardDate(holdUntil, org.timezone);
  await event(
    "REFERRAL",
    `Referral reward for ${code.code}: ${nairaText(amount)} (${pct}% of our ${nairaText(profit)} profit), pending until ${until}` +
      (capped
        ? `. ${CAP_FLAG_NOTE}: can be approved from ${formatBoardDate(month.end, org.timezone)}`
        : ""),
    { code: code.code, amountNaira: amount, capped },
    2,
  );
}
