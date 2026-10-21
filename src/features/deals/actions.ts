"use server";

// The team's deal actions (Invariants 7 and 15): safeAction (member first),
// scoped by organization, every status change through transitionDeal in
// the same transaction as its event, every other change logged as an
// event. Payment received and completed are only ever set here, by a member.
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { createDeal } from "@/features/deals/create";
import { amountToPayText, nairaText, rateText } from "@/features/deals/format";
import {
  getDealDeskContext,
  quoteBoardsOf,
} from "@/features/deals/public-queries";
import { agreedNairaFor, quoteDeal } from "@/features/deals/quote";
import { normalizeRef } from "@/features/deals/refs";
import {
  amountString,
  customerInput,
  dealDetailsV1,
  payoutInput,
} from "@/features/deals/schema";
import { createTrackingToken } from "@/features/deals/security";
import { notifyReferralCode } from "@/features/referrals/notify";
import {
  type NewCustomerCode,
  PROFIT_REQUIRED,
  profitField,
  recordProfitAndReward,
} from "@/features/referrals/rewards";
import {
  DealTransitionError,
  transitionDeal,
} from "@/features/deals/transitions";
import type { DealStatus, Prisma } from "@/generated/prisma/client";
import { type ActionResult, safeAction } from "@/lib/server/action";
import type { Member } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { isDecimalString } from "@/lib/decimal";

const CHANGED = "This deal has just changed. Reload to see its latest status.";

function revalidateDeal(ref: string) {
  revalidatePath(`/admin/deals/${ref}`);
  revalidatePath("/admin/deals");
  // The sidebar badge (admin layout) and the dashboard line.
  revalidatePath("/admin", "layout");
}

type LoadedDeal = {
  id: string;
  ref: string;
  status: DealStatus;
  service: import("@/generated/prisma/client").DealService;
  amount: string;
  currency: string;
  details: unknown;
  agreedNaira: string | null;
  customerName: string;
  paymentAccountId: string | null;
  referralCodeId: string | null;
};

async function loadDeal(
  organizationId: string,
  rawRef: unknown,
): Promise<LoadedDeal | null> {
  const ref = typeof rawRef === "string" ? normalizeRef(rawRef) : null;
  if (!ref) return null;
  const d = await db.deal.findUnique({
    where: { organizationId_ref: { organizationId, ref } },
    select: {
      id: true,
      ref: true,
      status: true,
      service: true,
      amount: true,
      currency: true,
      details: true,
      agreedNaira: true,
      customerName: true,
      paymentAccountId: true,
      referralCodeId: true,
    },
  });
  return d
    ? {
        ...d,
        amount: d.amount.toString(),
        agreedNaira: d.agreedNaira?.toString() ?? null,
      }
    : null;
}

// Runs a status change; a refused or stale transition becomes a message.
async function move(
  member: Member,
  deal: LoadedDeal,
  to: DealStatus,
  message: string,
  extra: {
    set?: Omit<
      Prisma.DealUncheckedUpdateManyInput,
      "status" | "statusChangedAt" | "id" | "organizationId"
    >;
    data?: Prisma.InputJsonValue;
    // More writes in the same transaction, after the status change.
    after?: (tx: Prisma.TransactionClient) => Promise<void>;
  } = {},
): Promise<ActionResult<{ status: DealStatus }>> {
  const { after: afterMove, ...options } = extra;
  try {
    await db.$transaction(async (tx) => {
      await transitionDeal(
        tx,
        deal,
        to,
        { type: "MEMBER", membershipId: member.membershipId },
        { message, ...options },
      );
      await afterMove?.(tx);
    }, MOVE_TX);
  } catch (error) {
    if (error instanceof DealTransitionError)
      return {
        ok: false,
        error:
          error.code === "CHANGED"
            ? CHANGED
            : "That step isn’t possible for this deal.",
      };
    throw error;
  }
  revalidateDeal(deal.ref);
  return { ok: true, data: { status: to } };
}

// A completion also records the profit, the reward and the customer's
// code: a few more queries, so more time than Prisma's 5 s default.
const MOVE_TX = { maxWait: 10_000, timeout: 15_000 };

const NOT_FOUND: ActionResult<never> = {
  ok: false,
  error: "That deal doesn’t exist. Reload the page.",
};

// ── Agree the rate (and change it later) ─────────────────────────────

const rateInput = z.object({
  ref: z.string(),
  agreedRate: z
    .string()
    .transform((v) => v.trim().replace(/,/g, ""))
    .pipe(
      z
        .string()
        .refine(
          (v) => isDecimalString(v) && Number(v) > 0,
          "Enter the agreed rate.",
        ),
    ),
  fee: z
    .string()
    .transform((v) => v.trim().replace(/,/g, "") || "0")
    .pipe(
      z
        .string()
        .refine(
          (v) => isDecimalString(v) && Number(v) >= 0,
          "Enter a fee of 0 or more.",
        ),
    ),
  reason: z.string().trim().max(200).optional(),
});

export const agreeDealRate = safeAction(
  async (
    member,
    raw: unknown,
  ): Promise<ActionResult<{ agreedNaira: string }>> => {
    const parsed = rateInput.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues)
        fieldErrors[String(i.path[0])] ??= i.message;
      return {
        ok: false,
        error: "Please check the highlighted fields.",
        fieldErrors,
      };
    }
    const { agreedRate, fee, reason } = parsed.data;
    const deal = await loadDeal(member.organizationId, parsed.data.ref);
    if (!deal) return NOT_FOUND;

    const details = dealDetailsV1.safeParse(deal.details);
    const months =
      details.success && details.data.service === "POF"
        ? details.data.months
        : 1;
    const agreedNaira = agreedNairaFor(
      deal.service,
      deal.amount,
      agreedRate,
      fee,
      months,
    );
    const values = {
      agreedRate,
      feeNaira: fee,
      agreedNaira,
      agreedAt: new Date(),
      agreedById: member.membershipId,
    };
    const summary = `${rateText(deal.service, agreedRate, deal.currency)}${fee !== "0" ? `, fee ${nairaText(fee)}` : ""}, total ${nairaText(agreedNaira)}`;

    if (deal.status === "NEW") {
      const r = await move(member, deal, "AGREED", `Rate agreed: ${summary}`, {
        set: values,
        data: { agreedRate, fee, agreedNaira },
      });
      return r.ok ? { ok: true, data: { agreedNaira } } : r;
    }
    if (deal.status !== "AGREED" && deal.status !== "AWAITING_PAYMENT")
      return {
        ok: false,
        error: "The rate can’t change after the payment is received.",
      };
    // Once the customer has our payment details, a change needs a reason.
    if (deal.status === "AWAITING_PAYMENT" && !reason)
      return {
        ok: false,
        error: "Payment details were already shared. Say why the rate changes.",
        fieldErrors: { reason: "Give a reason for the change." },
      };

    await db
      .$transaction(async (tx) => {
        const { count } = await tx.deal.updateMany({
          where: { id: deal.id, status: deal.status },
          data: values,
        });
        if (count !== 1) throw new DealTransitionError(CHANGED, "CHANGED");
        await tx.dealEvent.create({
          data: {
            dealId: deal.id,
            type: "RATE_CHANGED",
            message: `Rate changed: ${summary}${reason ? `. Reason: ${reason}` : ""}`,
            data: { agreedRate, fee, agreedNaira, reason: reason ?? null },
            actorType: "MEMBER",
            actorMembershipId: member.membershipId,
          },
        });
      })
      .catch((error) => {
        if (error instanceof DealTransitionError) return null;
        throw error;
      });
    revalidateDeal(deal.ref);
    return { ok: true, data: { agreedNaira } };
  },
);

// ── Status steps ──────────────────────────────────────────────────────

export const sharePaymentDetails = safeAction(
  async (
    member,
    rawRef: unknown,
    accountId: unknown,
  ): Promise<ActionResult<{ status: DealStatus }>> => {
    const deal = await loadDeal(member.organizationId, rawRef);
    if (!deal) return NOT_FOUND;
    const account =
      typeof accountId === "string"
        ? await db.paymentAccount.findFirst({
            where: {
              id: accountId,
              organizationId: member.organizationId,
              active: true,
              services: { has: deal.service },
            },
            select: { id: true, bank: true, accountNumber: true },
          })
        : null;
    if (!account)
      return {
        ok: false,
        error: "Choose one of our active accounts for this service.",
      };
    return move(
      member,
      deal,
      "AWAITING_PAYMENT",
      `Payment details shared: ${account.bank} ••${account.accountNumber.slice(-4)}`,
      {
        set: { paymentAccountId: account.id },
        data: { paymentAccountId: account.id },
      },
    );
  },
);

export const markPaymentReceived = safeAction(
  async (
    member,
    rawRef: unknown,
  ): Promise<ActionResult<{ status: DealStatus }>> => {
    const deal = await loadDeal(member.organizationId, rawRef);
    if (!deal) return NOT_FOUND;
    const amount =
      amountToPayText(
        deal.service,
        deal.amount,
        deal.currency,
        deal.agreedNaira,
      ) ?? "the payment";
    return move(
      member,
      deal,
      "PAYMENT_RECEIVED",
      `Payment received: ${amount} checked on the bank statement`,
    );
  },
);

const sentInput = z.object({
  ref: z.string(),
  reference: z.string().trim().max(80).optional(),
});

export const markDealSent = safeAction(
  async (
    member,
    raw: unknown,
  ): Promise<ActionResult<{ status: DealStatus }>> => {
    const parsed = sentInput.safeParse(raw);
    if (!parsed.success)
      return { ok: false, error: "Please check the reference." };
    const deal = await loadDeal(member.organizationId, parsed.data.ref);
    if (!deal) return NOT_FOUND;
    const reference = parsed.data.reference || undefined;
    return move(
      member,
      deal,
      "PROCESSING",
      `Marked sent${reference ? ` (reference ${reference})` : ""}`,
      {
        set: reference ? { payoutReference: reference } : undefined,
      },
    );
  },
);

// Completed, with our profit on the deal (Phase 13c): required when the
// deal has a referral code, since the reward is a share of it.
const completeInput = z.object({ ref: z.string(), profit: profitField });

export const markDealCompleted = safeAction(
  async (
    member,
    raw: unknown,
  ): Promise<ActionResult<{ status: DealStatus }>> => {
    const parsed = completeInput.safeParse(
      typeof raw === "string" ? { ref: raw } : raw,
    );
    if (!parsed.success)
      return {
        ok: false,
        error: "Please check the highlighted fields.",
        fieldErrors: { profit: parsed.error.issues[0]?.message ?? "" },
      };
    const deal = await loadDeal(member.organizationId, parsed.data.ref);
    if (!deal) return NOT_FOUND;
    const { profit } = parsed.data;
    if (deal.referralCodeId && profit === null)
      return {
        ok: false,
        error: PROFIT_REQUIRED,
        fieldErrors: { profit: PROFIT_REQUIRED },
      };
    let newCode: NewCustomerCode = null;
    const result = await move(member, deal, "COMPLETED", "Deal completed", {
      set: profit === null ? undefined : { profitNaira: profit },
      after: async (tx) => {
        newCode = await recordProfitAndReward(tx, {
          dealId: deal.id,
          profit,
          membershipId: member.membershipId,
        });
      },
    });
    // The customer's own referral code, by email (after the response).
    const created = newCode as NewCustomerCode;
    if (result.ok && created) after(() => notifyReferralCode(deal.id, created));
    return result;
  },
);

const cancelInput = z.object({
  ref: z.string(),
  reason: z.string().trim().min(3, "Give a reason.").max(200),
});

export const cancelDeal = safeAction(
  async (
    member,
    raw: unknown,
  ): Promise<ActionResult<{ status: DealStatus }>> => {
    const parsed = cancelInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: "Give a reason for cancelling.",
        fieldErrors: { reason: "Give a reason." },
      };
    const deal = await loadDeal(member.organizationId, parsed.data.ref);
    if (!deal) return NOT_FOUND;
    return move(member, deal, "CANCELLED", `Cancelled: ${parsed.data.reason}`, {
      set: { cancelReason: parsed.data.reason },
    });
  },
);

// ── Owner and notes (events, no status change) ───────────────────────

export const setDealOwner = safeAction(
  async (
    member,
    rawRef: unknown,
    ownerId: unknown,
  ): Promise<ActionResult<{ ownerId: string | null }>> => {
    const deal = await loadDeal(member.organizationId, rawRef);
    if (!deal) return NOT_FOUND;
    const owner =
      typeof ownerId === "string" && ownerId
        ? await db.membership.findFirst({
            where: { id: ownerId, organizationId: member.organizationId },
            select: { id: true },
          })
        : null;
    if (ownerId && !owner) return { ok: false, error: "Choose a team member." };
    await db.$transaction([
      db.deal.update({
        where: { id: deal.id },
        data: { ownerMembershipId: owner?.id ?? null },
      }),
      db.dealEvent.create({
        data: {
          dealId: deal.id,
          type: "OWNER_CHANGED",
          message: owner ? "Owner changed" : "Owner removed",
          data: { ownerMembershipId: owner?.id ?? null },
          actorType: "MEMBER",
          actorMembershipId: member.membershipId,
        },
      }),
    ]);
    revalidateDeal(deal.ref);
    return { ok: true, data: { ownerId: owner?.id ?? null } };
  },
);

const noteInput = z.object({
  ref: z.string(),
  text: z.string().trim().min(1, "Write a note.").max(1000),
});

export const addDealNote = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ added: true }>> => {
    const parsed = noteInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Write a note first." };
    const deal = await loadDeal(member.organizationId, parsed.data.ref);
    if (!deal) return NOT_FOUND;
    await db.dealEvent.create({
      data: {
        dealId: deal.id,
        type: "NOTE",
        message: parsed.data.text,
        actorType: "MEMBER",
        actorMembershipId: member.membershipId,
      },
    });
    revalidateDeal(deal.ref);
    return { ok: true, data: { added: true } };
  },
);

// ── New deal (started on WhatsApp) ────────────────────────────────────

const teamDealInput = z.object({
  details: dealDetailsV1,
  currency: z.string().regex(/^[A-Z]{3}$/, "A 3-letter code."),
  amount: amountString,
  customer: customerInput,
  payout: payoutInput.optional(),
});

export const createTeamDeal = safeAction(
  async (
    member,
    raw: unknown,
  ): Promise<ActionResult<{ ref: string; token: string }>> => {
    const parsed = teamDealInput.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues)
        fieldErrors[i.path.map(String).join(".")] ??= i.message;
      return {
        ok: false,
        error: "Please check the highlighted fields.",
        fieldErrors,
      };
    }
    const input = parsed.data;
    const service = input.details.service;
    if (service === "POF" && input.currency !== "NGN")
      return { ok: false, error: "Proof of funds is in naira." };
    if (service === "FOREX_SELL" && !input.payout)
      return {
        ok: false,
        error: "Add the customer’s account for the naira.",
        fieldErrors: { "payout.accountNumber": "Required." },
      };

    // Same estimate rules as the website, from the latest boards.
    const ctx = await getDealDeskContext();
    const quote =
      ctx && ctx.org.id === member.organizationId
        ? quoteDeal(
            {
              service,
              currency: input.currency,
              amount: input.amount,
              details: input.details,
            },
            quoteBoardsOf(ctx),
          )
        : null;
    const details =
      input.details.service === "POF" && quote?.bankName
        ? { ...input.details, bankName: quote.bankName }
        : input.details;
    const { token, hash } = createTrackingToken();
    const deal = await createDeal({
      organizationId: member.organizationId,
      service,
      customer: input.customer,
      details,
      currency: input.currency,
      amount: input.amount,
      quote,
      payout:
        service === "FOREX_SELL" && input.payout
          ? { ...input.payout, accountName: input.customer.name }
          : undefined,
      ownerMembershipId: member.membershipId,
      trackingTokenHash: hash,
      ipHash: null,
      actor: { type: "MEMBER", membershipId: member.membershipId },
      message: "Added by the team (started on WhatsApp)",
    });
    revalidateDeal(deal.ref);
    return { ok: true, data: { ref: deal.ref, token } };
  },
);
