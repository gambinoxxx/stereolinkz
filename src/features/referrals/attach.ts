import "server-only";

// Attaching a referral code to a deal: at creation (the form's code,
// prefilled from the /r/ or ?ref= cookie), or by the team while the deal
// is NEW (with a reason). Two steps:
// 1. checkCode, before anything is written: is a TYPED code known and
//    active? If not, the friendly "We couldn't find that code" (the
//    customer can clear it and submit).
// 2. decideAttach, inside the deal's transaction: the five attribution
//    rules (a campaign in force, the code active, not the owner's own
//    number, a new customer, an eligible service). Failing one never
//    blocks the deal and is never shown to the customer: the deal goes
//    ahead without a referral, and the reason is logged for the team.
import {
  type Campaign,
  campaignInForce,
  normalizeCode,
  serviceEligible,
} from "@/features/referrals/rules";
import type {
  DealService,
  Prisma,
  ReferralKind,
} from "@/generated/prisma/client";
import { db } from "@/lib/server/db";

export type CodeRow = {
  id: string;
  code: string;
  kind: ReferralKind;
  membershipId: string | null;
  customerWhatsapp: string | null;
};

const CODE_SELECT = {
  id: true,
  code: true,
  kind: true,
  membershipId: true,
  customerWhatsapp: true,
  active: true,
} as const;

export const CODE_NOT_FOUND =
  "We couldn’t find that code. Check it or leave it blank.";

export type CodeCheck =
  | { ok: true; code: CodeRow | null } // null: no code given
  | { ok: false; error: string };

const CAMPAIGN_SELECT = {
  id: true,
  active: true,
  startsAt: true,
  endsAt: true,
  rewardBps: true,
  includeCrypto: true,
} as const;

// The campaign in force right now, if any.
export async function campaignInForceNow(
  client: Pick<Prisma.TransactionClient, "referralCampaign">,
  organizationId: string,
  now: Date,
): Promise<Campaign | null> {
  const c = await client.referralCampaign.findFirst({
    where: { organizationId, active: true },
    select: CAMPAIGN_SELECT,
  });
  return c && campaignInForce(c, now) ? c : null;
}

// A typed code: known and active, or the friendly error. Says nothing
// about campaigns or the other rules.
export async function checkCode(
  organizationId: string,
  raw: unknown,
): Promise<CodeCheck> {
  if (typeof raw !== "string" || raw.trim() === "")
    return { ok: true, code: null };
  const code = normalizeCode(raw);
  if (!code) return { ok: false, error: CODE_NOT_FOUND };
  const row = await db.referralCode.findUnique({
    where: { organizationId_code: { organizationId, code } },
    select: CODE_SELECT,
  });
  if (!row || !row.active) return { ok: false, error: CODE_NOT_FOUND };
  return {
    ok: true,
    code: {
      id: row.id,
      code: row.code,
      kind: row.kind,
      membershipId: row.membershipId,
      customerWhatsapp: row.customerWhatsapp,
    },
  };
}

export type AttachDecision =
  | { attach: true; campaignId: string; message: string }
  | { attach: false; message: string };

// Statuses that make a number a returning customer.
const DONE = ["COMPLETED", "PAID_OUT"] as const;

// The five rules, inside the deal's transaction. `excludeDealId`: when
// the team attaches to an existing deal.
export async function decideAttach(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    code: CodeRow;
    customerWhatsapp: string;
    service: DealService;
    now: Date;
    excludeDealId?: string;
  },
): Promise<AttachDecision> {
  const { code } = input;
  const notApplied = (why: string) => ({
    attach: false as const,
    message: `Referral code ${code.code} not applied: ${why}`,
  });

  const campaign = await campaignInForceNow(
    tx,
    input.organizationId,
    input.now,
  );
  if (!campaign) return notApplied("no referral campaign is running");

  const live = await tx.referralCode.findUnique({
    where: { id: code.id },
    select: { active: true },
  });
  if (!live?.active) return notApplied("the code isn’t active");

  if (code.kind === "STAFF" && code.membershipId) {
    const owner = await tx.membership.findFirst({
      where: { id: code.membershipId, organizationId: input.organizationId },
      select: { whatsapp: true },
    });
    if (owner?.whatsapp && owner.whatsapp === input.customerWhatsapp)
      return notApplied("it’s the code owner’s own WhatsApp number");
  }
  if (
    code.kind === "CUSTOMER" &&
    code.customerWhatsapp === input.customerWhatsapp
  )
    return notApplied("it’s the code owner’s own WhatsApp number");

  const earlier = await tx.deal.count({
    where: {
      organizationId: input.organizationId,
      customerWhatsapp: input.customerWhatsapp,
      status: { in: [...DONE] },
      ...(input.excludeDealId && { id: { not: input.excludeDealId } }),
    },
  });
  if (earlier > 0)
    return notApplied("this customer has completed a deal with us before");

  if (!serviceEligible(campaign, input.service))
    return notApplied("this service isn’t part of the campaign");

  return {
    attach: true,
    campaignId: campaign.id,
    message: `Referral code ${code.code} applied`,
  };
}
