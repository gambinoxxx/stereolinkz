import "server-only";

// The referrer's own view (a customer's code): reached with the private
// page token (/referrals/[token], only its hash is stored) or with their
// deal's tracking token (/deal/[ref]/referrals?t=…). It shows their code,
// campaign, totals and a MASKED list of referred deals: deal ref, status
// and reward only, never the referred person's name, number, email or
// deal amount (REFERRER_DEAL_SELECT is the whole list of what's read).
import { findDealIdByToken } from "@/features/deals/access";
import { getDealDeskContext } from "@/features/deals/public-queries";
import { hashToken } from "@/features/deals/security";
import { campaignInForceNow } from "@/features/referrals/attach";
import { isoDayIn } from "@/features/referrals/labels";
import {
  bpsToPct,
  displayStatus,
  type RewardDisplayStatus,
} from "@/features/referrals/rules";
import type { DealStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/server/db";
import { siteUrl } from "@/lib/site-url";

// What a referred deal shows the referrer. Nothing about the person.
export const REFERRER_DEAL_SELECT = {
  ref: true,
  status: true,
  createdAt: true,
  referralReward: {
    select: {
      amountNaira: true,
      status: true,
      holdUntil: true,
      notBefore: true,
      flag: true,
    },
  },
} as const;

export type ReferredDeal = {
  ref: string;
  progress: "In progress" | "Completed" | "Cancelled";
  reward: {
    amountNaira: string;
    status: "pending" | "approved" | "paid" | "void";
  } | null;
};

export type ReferrerView = {
  code: string;
  shareUrl: string;
  campaign: { pct: string; endsOn: string } | null; // in force now; its last day
  totals: { deals: number; pending: string; approved: string; paid: string };
  deals: ReferredDeal[];
  contactLine: string | null;
  brand: string;
};

const PROGRESS: Record<DealStatus, ReferredDeal["progress"]> = {
  NEW: "In progress",
  AGREED: "In progress",
  AWAITING_PAYMENT: "In progress",
  PAYMENT_RECEIVED: "In progress",
  PROCESSING: "In progress",
  AWAITING_DEPOSIT: "In progress",
  DEPOSIT_SEEN: "In progress",
  DEPOSIT_COMPLETE: "In progress",
  RATE_TO_AGREE: "In progress",
  FLAGGED: "In progress",
  COMPLETED: "Completed",
  PAID_OUT: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Cancelled",
};

const REWARD_WORD: Record<
  RewardDisplayStatus,
  NonNullable<ReferredDeal["reward"]>["status"]
> = {
  PENDING: "pending",
  READY: "pending",
  APPROVED: "approved",
  PAID: "paid",
  VOID: "void",
};

async function viewFor(
  codeId: string,
  now: Date,
): Promise<ReferrerView | null> {
  const ctx = await getDealDeskContext();
  if (!ctx) return null;
  const code = await db.referralCode.findFirst({
    where: {
      id: codeId,
      organizationId: ctx.org.id,
      kind: "CUSTOMER",
      active: true,
    },
    select: {
      code: true,
      deals: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: REFERRER_DEAL_SELECT,
      },
    },
  });
  if (!code) return null;
  const [campaign, org] = await Promise.all([
    campaignInForceNow(db, ctx.org.id, now),
    db.organization.findUniqueOrThrow({
      where: { id: ctx.org.id },
      select: { timezone: true },
    }),
  ]);
  const totals = { pending: BigInt(0), approved: BigInt(0), paid: BigInt(0) };
  const deals = code.deals.map((d): ReferredDeal => {
    const r = d.referralReward;
    const status = r ? REWARD_WORD[displayStatus(r, now)] : null;
    const amount = r?.amountNaira.toFixed() ?? "0";
    if (status === "pending") totals.pending += BigInt(amount);
    if (status === "approved") totals.approved += BigInt(amount);
    if (status === "paid") totals.paid += BigInt(amount);
    return {
      ref: d.ref,
      progress: PROGRESS[d.status],
      reward: r && status ? { amountNaira: amount, status } : null,
    };
  });
  return {
    code: code.code,
    shareUrl: new URL(`/r/${code.code}`, siteUrl()).href,
    campaign: campaign
      ? {
          pct: bpsToPct(campaign.rewardBps),
          endsOn: isoDayIn(
            new Date(campaign.endsAt.getTime() - 1),
            org.timezone,
          ),
        }
      : null,
    totals: {
      deals: deals.length,
      pending: totals.pending.toString(),
      approved: totals.approved.toString(),
      paid: totals.paid.toString(),
    },
    deals,
    contactLine: ctx.org.contactLine,
    brand: ctx.org.name,
  };
}

// /referrals/[token]: the page token (32 random bytes, base64url).
export async function referrerByPageToken(
  token: string,
  now = new Date(),
): Promise<ReferrerView | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await db.referralCode.findUnique({
    where: { pageTokenHash: hashToken(token) },
    select: { id: true },
  });
  return row ? viewFor(row.id, now) : null;
}

// /deal/[ref]/referrals?t=…: the same access as the tracking page; the
// code is the one for that deal's own number.
export async function referrerByDeal(
  ref: string,
  token: string | null,
  now = new Date(),
): Promise<ReferrerView | null> {
  const ctx = await getDealDeskContext();
  if (!ctx) return null;
  const dealId = await findDealIdByToken(ctx.org.id, ref, token);
  if (!dealId) return null;
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: { customerWhatsapp: true },
  });
  const code = deal
    ? await db.referralCode.findFirst({
        where: {
          organizationId: ctx.org.id,
          kind: "CUSTOMER",
          customerWhatsapp: deal.customerWhatsapp,
          active: true,
        },
        select: { id: true },
      })
    : null;
  return code ? viewFor(code.id, now) : null;
}

// For the tracking page's card on a completed deal: the customer's own
// code, and the campaign % in force (null when none is running).
export async function cardForDeal(
  organizationId: string,
  dealId: string,
  now = new Date(),
): Promise<{ code: string; shareUrl: string; pct: string | null } | null> {
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: { status: true, customerWhatsapp: true },
  });
  if (!deal || (deal.status !== "COMPLETED" && deal.status !== "PAID_OUT"))
    return null;
  const [code, campaign] = await Promise.all([
    db.referralCode.findFirst({
      where: {
        organizationId,
        kind: "CUSTOMER",
        customerWhatsapp: deal.customerWhatsapp,
        active: true,
      },
      select: { code: true },
    }),
    campaignInForceNow(db, organizationId, now),
  ]);
  if (!code) return null;
  return {
    code: code.code,
    shareUrl: new URL(`/r/${code.code}`, siteUrl()).href,
    pct: campaign ? bpsToPct(campaign.rewardBps) : null,
  };
}
