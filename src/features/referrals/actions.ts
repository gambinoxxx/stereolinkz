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
import {
  checkCode,
  decideAttach,
  programmeSettings,
} from "@/features/referrals/attach";
import { isApprovable, passesCap } from "@/features/referrals/rules";
import {
  attachCodeInput,
  payRewardsInput,
  referralSettingsInput,
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

// ── Settings → Referrals ──────────────────────────────────────────────

export const updateReferralSettings = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ saved: true }>> => {
    const denied = ownerOnly(member);
    if (denied) return denied;
    const parsed = referralSettingsInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    const v = parsed.data;
    const startsAt = await dayStart(member.organizationId, v.startsOn);
    // The end date is the last day on: the programme stops at the start of
    // the next day.
    const endsAt = new Date(
      (await dayStart(member.organizationId, v.endsOn)).getTime() +
        24 * 60 * 60_000,
    );
    await db.organization.update({
      where: { id: member.organizationId },
      data: {
        referralEnabled: v.enabled,
        referralStartsAt: startsAt,
        referralEndsAt: endsAt,
        referralRewardPct: v.rewardPct,
        referralHoldDays: v.holdDays,
        referralNewCustomersOnly: v.newCustomersOnly,
        referralMonthlyCapNaira: v.monthlyCap,
        referralServices: v.services,
      },
    });
    revalidateReferrals();
    // The deal forms show the code field only while the programme is on.
    revalidatePublicPages();
    return { ok: true, data: { saved: true } };
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
        return count === 1 ? "ok" : `${r.dealRef}: changed, reload`;
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
    const { count } = await db.referralReward.updateMany({
      where: {
        id: { in: parsed.data.ids },
        organizationId: member.organizationId,
        status: "APPROVED",
      },
      data: {
        status: "PAID",
        paidAt,
        paidById: member.membershipId,
        bankReference: parsed.data.bankReference,
      },
    });
    if (count === 0)
      return { ok: false, error: "Only approved rewards can be marked paid." };
    revalidateReferrals();
    return { ok: true, data: { paid: count } };
  },
);

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
    const { count } = await db.referralReward.updateMany({
      where: {
        id: parsed.data.id,
        organizationId: member.organizationId,
        status: { in: ["PENDING", "APPROVED"] },
      },
      data: {
        status: "VOID",
        voidedAt: new Date(),
        voidedById: member.membershipId,
        voidReason: parsed.data.reason,
      },
    });
    if (count !== 1)
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
    const { count } = await db.referralReward.updateMany({
      where: {
        id: String(id),
        organizationId: member.organizationId,
        status: "PENDING",
        flag: { not: null },
      },
      data: { flag: null },
    });
    if (count !== 1) return { ok: false, error: "Nothing to clear. Reload." };
    revalidateReferrals();
    return { ok: true, data: { id: String(id) } };
  },
);

// ── A deal's code (any team member) ───────────────────────────────────
// Attach, change or remove while the deal is NEW or AWAITING_DEPOSIT, with
// the same checks as the website. Logged on the deal.

export const setDealReferralCode = safeAction(
  async (
    member,
    raw: unknown,
  ): Promise<ActionResult<{ code: string | null }>> => {
    const parsed = attachCodeInput.safeParse(raw);
    const ref = parsed.success ? normalizeRef(parsed.data.ref) : null;
    if (!parsed.success || !ref)
      return { ok: false, error: "That deal doesn’t exist. Reload the page." };
    const deal = await db.deal.findUnique({
      where: {
        organizationId_ref: { organizationId: member.organizationId, ref },
      },
      select: {
        id: true,
        status: true,
        service: true,
        customerWhatsapp: true,
        referralCode: { select: { code: true } },
      },
    });
    if (!deal)
      return { ok: false, error: "That deal doesn’t exist. Reload the page." };
    if (deal.status !== "NEW" && deal.status !== "AWAITING_DEPOSIT")
      return {
        ok: false,
        error: "The referral code is locked once the deal is agreed.",
      };
    const now = new Date();
    const actor = {
      actorType: "MEMBER" as const,
      actorMembershipId: member.membershipId,
    };

    if (parsed.data.code === "") {
      if (!deal.referralCode) return { ok: true, data: { code: null } };
      await db.$transaction([
        db.deal.updateMany({
          where: { id: deal.id, status: deal.status },
          data: { referralCodeId: null },
        }),
        db.dealEvent.create({
          data: {
            dealId: deal.id,
            type: "REFERRAL",
            message: `Referral code ${deal.referralCode.code} removed`,
            ...actor,
          },
        }),
      ]);
      revalidatePath(`/admin/deals/${ref}`);
      return { ok: true, data: { code: null } };
    }

    const check = await checkCode(
      member.organizationId,
      parsed.data.code,
      deal.service,
      now,
    );
    if (!check.ok)
      return {
        ok: false,
        error: check.error,
        fieldErrors: { code: check.error },
      };
    if (!check.code)
      return {
        ok: false,
        error: "The referral programme is off for this service right now.",
      };
    const code = check.code;
    const settings = await programmeSettings(member.organizationId);
    const decision = await db.$transaction(async (tx) => {
      const d = await decideAttach(tx, {
        organizationId: member.organizationId,
        code,
        customerWhatsapp: deal.customerWhatsapp,
        newCustomersOnly: settings.referralNewCustomersOnly,
        excludeDealId: deal.id,
      });
      if (d.attach) {
        const { count } = await tx.deal.updateMany({
          where: { id: deal.id, status: deal.status },
          data: { referralCodeId: code.id },
        });
        if (count !== 1) return null;
      }
      await tx.dealEvent.create({
        data: {
          dealId: deal.id,
          type: "REFERRAL",
          message: d.attach ? `${d.message} by the team` : d.message,
          data: { code: code.code, applied: d.attach },
          ...actor,
        },
      });
      return d;
    });
    revalidatePath(`/admin/deals/${ref}`);
    if (!decision)
      return { ok: false, error: "This deal has just changed. Reload." };
    if (!decision.attach) return { ok: false, error: decision.message };
    return { ok: true, data: { code: code.code } };
  },
);
