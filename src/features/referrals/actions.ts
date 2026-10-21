"use server";

// Referral programme actions (Phase 13c). Every action is a safeAction
// (member first) scoped by organization; changing the programme, codes or
// rewards is for an OWNER only, checked here in each action, never just in
// the page. Reward status changes are conditional on the status seen, so
// two people acting at once can't both succeed (and a trigger refuses a
// backwards move).
import { revalidatePath } from "next/cache";

import { normalizeRef } from "@/features/deals/refs";
import { ownerOnly } from "@/features/referrals/owner";
import { revalidatePublicPages } from "@/features/public/revalidate";
import { checkCode, decideAttach } from "@/features/referrals/attach";
import { nairaText } from "@/features/deals/format";
import { createTrackingToken } from "@/features/deals/security";
import { siteUrl } from "@/lib/site-url";
import { isApprovable, passesCap } from "@/features/referrals/rules";
import {
  attachCodeInput,
  campaignInput,
  payRewardsInput,
  pctToBps,
  programmeRulesInput,
  removeReferralInput,
  rewardIdsInput,
  staffCodeInput,
  voidRewardInput,
} from "@/features/referrals/schema";
import { normalizeWhatsAppNumber } from "@/features/settings/schema";
import { Prisma } from "@/generated/prisma/client";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";
import { monthInTimeZone, startOfDayInTimeZone } from "@/lib/format";

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[i.path.map(String).join(".")] ??= i.message;
  return out;
}

const CHECK = "Please check the highlighted fields.";

function revalidateReferrals() {
  revalidatePath("/admin/referrals");
  revalidatePath("/admin/settings/referrals");
  revalidatePath("/admin");
}

// A day in the org's time zone → the instant it starts.
async function dayStart(organizationId: string, day: string) {
  const { timezone } = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { timezone: true },
  });
  return startOfDayInTimeZone(new Date(`${day}T12:00:00Z`), timezone);
}

// ── Settings → Referrals: programme rules (owner) ─────────────────────

export const updateProgrammeRules = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ saved: true }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    const parsed = programmeRulesInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    await db.organization.update({
      where: { id: member.organizationId },
      data: {
        referralHoldDays: parsed.data.holdDays,
        referralMonthlyCapNaira: parsed.data.monthlyCap,
      },
    });
    revalidateReferrals();
    return { ok: true, data: { saved: true } };
  },
);

// ── Campaigns (owner) ─────────────────────────────────────────────────
// Created switched off; started and ended by hand. One active at a time
// (a unique index refuses a second). The deal forms show the code field
// only while one is in force, so starting or ending one refreshes them.

export const createCampaign = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ id: string }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    const parsed = campaignInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    const v = parsed.data;
    const startsAt = await dayStart(member.organizationId, v.startsOn);
    // The last day runs to midnight: it ends at the start of the next day.
    const endsAt = new Date(
      (await dayStart(member.organizationId, v.endsOn)).getTime() +
        24 * 60 * 60_000,
    );
    const campaign = await db.referralCampaign.create({
      data: {
        organizationId: member.organizationId,
        name: v.name,
        startsAt,
        endsAt,
        rewardBps: pctToBps(v.rewardPct),
        includeCrypto: v.includeCrypto,
        createdById: member.membershipId,
      },
      select: { id: true },
    });
    revalidateReferrals();
    return { ok: true, data: { id: campaign.id } };
  },
);

export const startCampaign = safeAction(
  async (member, id: unknown): Promise<ActionResult<{ id: string }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    try {
      const { count } = await db.referralCampaign.updateMany({
        where: {
          id: String(id),
          organizationId: member.organizationId,
          active: false,
        },
        data: { active: true },
      });
      if (count !== 1)
        return { ok: false, error: "That campaign is already on. Reload." };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return {
          ok: false,
          error: "Another campaign is on. End it first: one at a time.",
        };
      throw error;
    }
    revalidateReferrals();
    revalidatePublicPages();
    return { ok: true, data: { id: String(id) } };
  },
);

export const endCampaign = safeAction(
  async (member, id: unknown): Promise<ActionResult<{ id: string }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    const { count } = await db.referralCampaign.updateMany({
      where: {
        id: String(id),
        organizationId: member.organizationId,
        active: true,
      },
      data: { active: false },
    });
    if (count !== 1)
      return { ok: false, error: "That campaign is already off. Reload." };
    revalidateReferrals();
    revalidatePublicPages();
    return { ok: true, data: { id: String(id) } };
  },
);

// ── Staff codes ───────────────────────────────────────────────────────

export const createStaffCode = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ code: string }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    const parsed = staffCodeInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    const { membershipId, code } = parsed.data;
    const whatsapp = parsed.data.whatsapp
      ? normalizeWhatsAppNumber(parsed.data.whatsapp)
      : null;
    if (parsed.data.whatsapp && !whatsapp)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: {
          whatsapp: "Enter a WhatsApp number, like 0803 123 4567.",
        },
      };
    const teamMember = await db.membership.findFirst({
      where: { id: membershipId, organizationId: member.organizationId },
      select: { id: true },
    });
    if (!teamMember)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: { membershipId: "Pick a team member." },
      };
    try {
      await db.$transaction([
        db.referralCode.create({
          data: {
            organizationId: member.organizationId,
            code,
            kind: "STAFF",
            membershipId,
          },
        }),
        ...(whatsapp
          ? [
              db.membership.update({
                where: { id: membershipId },
                data: { whatsapp },
              }),
            ]
          : []),
      ]);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return {
          ok: false,
          error: `${code} is already taken. Try another code.`,
          fieldErrors: { code: "Already taken." },
        };
      throw error;
    }
    revalidateReferrals();
    return { ok: true, data: { code } };
  },
);

export const setMemberWhatsapp = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ saved: true }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    const input = raw as { membershipId?: unknown; whatsapp?: unknown };
    const whatsapp =
      typeof input?.whatsapp === "string" && input.whatsapp.trim()
        ? normalizeWhatsAppNumber(input.whatsapp)
        : null;
    if (
      typeof input?.whatsapp === "string" &&
      input.whatsapp.trim() &&
      !whatsapp
    )
      return {
        ok: false,
        error: CHECK,
        fieldErrors: {
          whatsapp: "Enter a WhatsApp number, like 0803 123 4567.",
        },
      };
    const { count } = await db.membership.updateMany({
      where: {
        id: String(input?.membershipId ?? ""),
        organizationId: member.organizationId,
      },
      data: { whatsapp },
    });
    if (count !== 1)
      return { ok: false, error: "That team member isn’t here." };
    revalidateReferrals();
    return { ok: true, data: { saved: true } };
  },
);

export const deactivateReferralCode = safeAction(
  async (member, id: unknown): Promise<ActionResult<{ id: string }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    const { count } = await db.referralCode.updateMany({
      where: {
        id: String(id),
        organizationId: member.organizationId,
        active: true,
      },
      data: { active: false, deactivatedAt: new Date() },
    });
    if (count !== 1)
      return { ok: false, error: "That code is already inactive. Reload." };
    revalidateReferrals();
    return { ok: true, data: { id: String(id) } };
  },
);

// ── Rewards: approve, pay, void (OWNER) ───────────────────────────────
// Every change is logged on the deal (REWARD_CHANGED), in the same
// transaction, and is conditional on the status seen.

const rewardEvent = (
  tx: Prisma.TransactionClient,
  dealId: string,
  membershipId: string,
  message: string,
) =>
  tx.dealEvent.create({
    data: {
      dealId,
      type: "REWARD_CHANGED",
      message,
      actorType: "MEMBER",
      actorMembershipId: membershipId,
    },
  });

export const approveRewards = safeAction(
  async (
    member,
    raw: unknown,
  ): Promise<ActionResult<{ approved: number; skipped: string[] }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    const parsed = rewardIdsInput.safeParse(raw);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? CHECK };
    const now = new Date();
    const org = await db.organization.findUniqueOrThrow({
      where: { id: member.organizationId },
      select: { timezone: true, referralMonthlyCapNaira: true },
    });
    const month = monthInTimeZone(now, org.timezone);
    const cap = org.referralMonthlyCapNaira?.toFixed() ?? null;
    let approved = 0;
    const skipped: string[] = [];
    for (const id of parsed.data.ids) {
      const outcome = await db.$transaction(async (tx) => {
        const r = await tx.referralReward.findFirst({
          where: { id, organizationId: member.organizationId },
          select: {
            dealId: true,
            dealRef: true,
            referrerKey: true,
            amountNaira: true,
            status: true,
            holdUntil: true,
            notBefore: true,
            flag: true,
          },
        });
        if (!r) return "not found";
        if (!isApprovable(r, now)) return `${r.dealRef}: not ready yet`;
        if (r.flag && !parsed.data.confirmFlagged)
          return `${r.dealRef}: flagged, approve it on its own after checking`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${member.organizationId}:${r.referrerKey}`}))`;
        if (cap) {
          const total = await tx.referralReward.aggregate({
            where: {
              organizationId: member.organizationId,
              referrerKey: r.referrerKey,
              status: { in: ["APPROVED", "PAID"] },
              approvedAt: { gte: month.start, lt: month.end },
            },
            _sum: { amountNaira: true },
          });
          if (
            passesCap(
              cap,
              total._sum.amountNaira?.toFixed() ?? "0",
              r.amountNaira.toFixed(),
            )
          )
            return `${r.dealRef}: over this month’s cap, approve it next month`;
        }
        const { count } = await tx.referralReward.updateMany({
          where: {
            id,
            organizationId: member.organizationId,
            status: "PENDING",
          },
          data: {
            status: "APPROVED",
            approvedAt: now,
            approvedById: member.membershipId,
          },
        });
        if (count !== 1) return `${r.dealRef}: changed, reload`;
        await rewardEvent(
          tx,
          r.dealId,
          member.membershipId,
          `Referral reward approved (${nairaText(r.amountNaira.toFixed())})`,
        );
        return "ok";
      });
      if (outcome === "ok") approved++;
      else skipped.push(outcome);
    }
    revalidateReferrals();
    return { ok: true, data: { approved, skipped } };
  },
);

export const payRewards = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ paid: number }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    const parsed = payRewardsInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    const paidAt = await dayStart(member.organizationId, parsed.data.paidOn);
    const paid = await db.$transaction(async (tx) => {
      const rows = await tx.referralReward.findMany({
        where: {
          id: { in: parsed.data.ids },
          organizationId: member.organizationId,
          status: "APPROVED",
        },
        select: { id: true, dealId: true, amountNaira: true },
      });
      for (const r of rows) {
        const { count } = await tx.referralReward.updateMany({
          where: { id: r.id, status: "APPROVED" },
          data: {
            status: "PAID",
            paidAt,
            paidById: member.membershipId,
            bankReference: parsed.data.bankReference,
          },
        });
        if (count === 1)
          await rewardEvent(
            tx,
            r.dealId,
            member.membershipId,
            `Referral reward paid (${nairaText(r.amountNaira.toFixed())}, ref ${parsed.data.bankReference})`,
          );
      }
      return rows.length;
    });
    if (paid === 0)
      return { ok: false, error: "Only approved rewards can be marked paid." };
    revalidateReferrals();
    return { ok: true, data: { paid } };
  },
);

// Voids a pending or approved reward, logged. Shared by the ledger's Void
// and by removing a deal's referral.
async function voidRewardTx(
  tx: Prisma.TransactionClient,
  where: { id?: string; dealId?: string; organizationId: string },
  membershipId: string,
  reason: string,
): Promise<boolean> {
  const r = await tx.referralReward.findFirst({
    where: { ...where, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true, dealId: true },
  });
  if (!r) return false;
  const { count } = await tx.referralReward.updateMany({
    where: { id: r.id, status: { in: ["PENDING", "APPROVED"] } },
    data: {
      status: "VOID",
      voidedAt: new Date(),
      voidedById: membershipId,
      voidReason: reason,
    },
  });
  if (count === 1)
    await rewardEvent(
      tx,
      r.dealId,
      membershipId,
      `Referral reward voided: ${reason}`,
    );
  return count === 1;
}

export const voidReward = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ id: string }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    const parsed = voidRewardInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    const done = await db.$transaction((tx) =>
      voidRewardTx(
        tx,
        { id: parsed.data.id, organizationId: member.organizationId },
        member.membershipId,
        parsed.data.reason,
      ),
    );
    if (!done)
      return {
        ok: false,
        error: "Only pending or approved rewards can be voided.",
      };
    revalidateReferrals();
    return { ok: true, data: { id: parsed.data.id } };
  },
);

// Clearing a "possible self-referral" flag after checking, so the reward
// can become READY.
export const clearRewardFlag = safeAction(
  async (member, id: unknown): Promise<ActionResult<{ id: string }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    const done = await db.$transaction(async (tx) => {
      const r = await tx.referralReward.findFirst({
        where: {
          id: String(id),
          organizationId: member.organizationId,
          status: "PENDING",
          flag: { not: null },
        },
        select: { dealId: true },
      });
      if (!r) return false;
      await tx.referralReward.update({
        where: { id: String(id) },
        data: { flag: null },
      });
      await rewardEvent(
        tx,
        r.dealId,
        member.membershipId,
        "Referral reward checked: the self-referral flag was cleared",
      );
      return true;
    });
    if (!done) return { ok: false, error: "Nothing to clear. Reload." };
    revalidateReferrals();
    return { ok: true, data: { id: String(id) } };
  },
);

// ── A deal's referral (any team member) ───────────────────────────────

async function loadDeal(organizationId: string, rawRef: string) {
  const ref = normalizeRef(rawRef);
  if (!ref) return null;
  return db.deal.findUnique({
    where: { organizationId_ref: { organizationId, ref } },
    select: {
      id: true,
      ref: true,
      status: true,
      service: true,
      customerWhatsapp: true,
      referralCode: { select: { code: true } },
    },
  });
}

const NO_DEAL = "That deal doesn’t exist. Reload the page.";

// Attach a code to a NEW deal, with a reason. The five attribution rules
// still apply; a deal that already has a code keeps it (never swapped).
export const attachDealReferral = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ code: string }>> => {
    const parsed = attachCodeInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    const deal = await loadDeal(member.organizationId, parsed.data.ref);
    if (!deal) return { ok: false, error: NO_DEAL };
    if (deal.status !== "NEW")
      return {
        ok: false,
        error: "A code can be added only while the deal is New.",
      };
    if (deal.referralCode)
      return {
        ok: false,
        error: `This deal already has ${deal.referralCode.code}. Remove it first if it’s wrong.`,
      };
    const check = await checkCode(member.organizationId, parsed.data.code);
    if (!check.ok || !check.code)
      return {
        ok: false,
        error: check.ok ? CHECK : check.error,
        fieldErrors: { code: check.ok ? "Enter the code." : check.error },
      };
    const code = check.code;
    const decision = await db.$transaction(async (tx) => {
      const d = await decideAttach(tx, {
        organizationId: member.organizationId,
        code,
        customerWhatsapp: deal.customerWhatsapp,
        service: deal.service,
        now: new Date(),
        excludeDealId: deal.id,
      });
      if (d.attach) {
        const { count } = await tx.deal.updateMany({
          where: { id: deal.id, status: "NEW", referralCodeId: null },
          data: { referralCodeId: code.id, referralCampaignId: d.campaignId },
        });
        if (count !== 1) return null;
      }
      await tx.dealEvent.create({
        data: {
          dealId: deal.id,
          type: "REFERRAL",
          message: d.attach
            ? `${d.message} by the team: ${parsed.data.reason}`
            : d.message,
          data: {
            code: code.code,
            applied: d.attach,
            reason: parsed.data.reason,
          },
          actorType: "MEMBER",
          actorMembershipId: member.membershipId,
        },
      });
      return d;
    });
    revalidatePath(`/admin/deals/${deal.ref}`);
    if (!decision)
      return { ok: false, error: "This deal has just changed. Reload." };
    if (!decision.attach) return { ok: false, error: decision.message };
    return { ok: true, data: { code: code.code } };
  },
);

// Remove a deal's referral, with a reason; a pending or approved reward on
// it is voided with the same reason. A paid reward can't be undone here.
export const removeDealReferral = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ removed: true }>> => {
    const parsed = removeReferralInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    const deal = await loadDeal(member.organizationId, parsed.data.ref);
    if (!deal) return { ok: false, error: NO_DEAL };
    if (!deal.referralCode)
      return { ok: false, error: "This deal has no referral code." };
    const paid = await db.referralReward.count({
      where: { dealId: deal.id, status: "PAID" },
    });
    if (paid)
      return {
        ok: false,
        error: "The reward on this deal is already paid; it can’t be removed.",
      };
    const { reason } = parsed.data;
    await db.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id: deal.id },
        data: { referralCodeId: null, referralCampaignId: null },
      });
      await tx.dealEvent.create({
        data: {
          dealId: deal.id,
          type: "REFERRAL_REMOVED",
          message: `Referral code ${deal.referralCode!.code} removed: ${reason}`,
          data: { code: deal.referralCode!.code, reason },
          actorType: "MEMBER",
          actorMembershipId: member.membershipId,
        },
      });
      await voidRewardTx(
        tx,
        { dealId: deal.id, organizationId: member.organizationId },
        member.membershipId,
        reason,
      );
    });
    revalidatePath(`/admin/deals/${deal.ref}`);
    revalidateReferrals();
    return { ok: true, data: { removed: true } };
  },
);

// A new private referrer link for the deal's customer code (the old one
// stops working). The link is returned once, to send on WhatsApp.
export const newReferralPageLink = safeAction(
  async (member, rawRef: unknown): Promise<ActionResult<{ url: string }>> => {
    const deal =
      typeof rawRef === "string"
        ? await loadDeal(member.organizationId, rawRef)
        : null;
    if (!deal) return { ok: false, error: NO_DEAL };
    const code = await db.referralCode.findFirst({
      where: {
        organizationId: member.organizationId,
        kind: "CUSTOMER",
        customerWhatsapp: deal.customerWhatsapp,
        active: true,
      },
      select: { id: true, code: true },
    });
    if (!code)
      return { ok: false, error: "This customer has no referral code yet." };
    const { token, hash } = createTrackingToken();
    await db.$transaction([
      db.referralCode.update({
        where: { id: code.id },
        data: { pageTokenHash: hash, pageTokenAt: new Date() },
      }),
      db.dealEvent.create({
        data: {
          dealId: deal.id,
          type: "REFERRAL",
          message: `New private referrals link made for ${code.code} (the old one stopped working)`,
          actorType: "MEMBER",
          actorMembershipId: member.membershipId,
        },
      }),
    ]);
    revalidatePath(`/admin/deals/${deal.ref}`);
    return {
      ok: true,
      data: { url: new URL(`/referrals/${token}`, siteUrl()).href },
    };
  },
);
