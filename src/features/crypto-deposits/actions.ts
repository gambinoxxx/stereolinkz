"use server";

// The team's crypto deal actions (Invariants 7, 15 and 16): member first,
// scoped by organization, each status change through transitionDeal with
// its event. Paid out is only ever set here, with the bank reference and
// the account it was paid from.
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { runEthCheck } from "@/features/crypto-deposits/eth-check";
import {
  type Balance,
  walletBalance,
} from "@/features/crypto-deposits/providers/balances";
import type { EthCheck } from "@/features/crypto-deposits/providers/eth";
import { nairaText } from "@/features/deals/format";
import { notifyPaidOut } from "@/features/deals/notify";
import { normalizeRef } from "@/features/deals/refs";
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
import { multiplyDecimalStrings } from "@/lib/decimal";

const NOT_FOUND: ActionResult<never> = {
  ok: false,
  error: "That deal doesn’t exist. Reload the page.",
};
const CHANGED = "This deal has just changed. Reload to see its latest status.";

function revalidateDeal(ref: string) {
  revalidatePath(`/admin/deals/${ref}`);
  revalidatePath("/admin/deals");
  revalidatePath("/admin", "layout");
}

async function loadCryptoDeal(organizationId: string, rawRef: unknown) {
  const ref = typeof rawRef === "string" ? normalizeRef(rawRef) : null;
  if (!ref) return null;
  return db.deal.findFirst({
    where: { organizationId, ref, service: "CRYPTO_SELL" },
    select: {
      id: true,
      ref: true,
      status: true,
      expectedQty: true,
      quotedRate: true,
      agreedRate: true,
      referralCodeId: true,
      organization: {
        select: { rateLockMinutes: true, payoutTargetMinutes: true },
      },
    },
  });
}

async function move(
  member: Member,
  deal: { id: string; ref: string; status: DealStatus },
  to: DealStatus,
  message: string,
  extra: {
    set?: Omit<
      Prisma.DealUncheckedUpdateManyInput,
      "status" | "statusChangedAt" | "id" | "organizationId"
    >;
    data?: Prisma.InputJsonValue;
    events?: Prisma.DealEventCreateManyInput[];
    // More writes in the same transaction, after the status change.
    after?: (tx: Prisma.TransactionClient) => Promise<void>;
  } = {},
): Promise<ActionResult<{ status: DealStatus }>> {
  try {
    await db.$transaction(
      async (tx) => {
        await transitionDeal(
          tx,
          deal,
          to,
          { type: "MEMBER", membershipId: member.membershipId },
          { message, set: extra.set, data: extra.data },
        );
        if (extra.events?.length)
          await tx.dealEvent.createMany({ data: extra.events });
        await extra.after?.(tx);
      },
      { maxWait: 10_000, timeout: 15_000 },
    ); // the reward and code too
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

// ── Mark paid out ─────────────────────────────────────────────────────

const paidOutInput = z.object({
  ref: z.string(),
  reference: z
    .string()
    .trim()
    .min(3, "Enter the bank transfer reference.")
    .max(60),
  paidFromAccountId: z.string().min(1, "Choose the account you paid from."),
  // Our profit on the deal (Phase 13c): required with a referral code.
  profit: profitField,
});

export const markPaidOut = safeAction(
  async (
    member,
    raw: unknown,
  ): Promise<ActionResult<{ status: DealStatus }>> => {
    const parsed = paidOutInput.safeParse(raw);
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
    const deal = await loadCryptoDeal(member.organizationId, parsed.data.ref);
    if (!deal) return NOT_FOUND;
    const { profit } = parsed.data;
    if (deal.referralCodeId && profit === null)
      return {
        ok: false,
        error: PROFIT_REQUIRED,
        fieldErrors: { profit: PROFIT_REQUIRED },
      };
    const account = await db.paymentAccount.findFirst({
      where: {
        id: parsed.data.paidFromAccountId,
        organizationId: member.organizationId,
      },
      select: { id: true, bank: true, accountNumber: true },
    });
    if (!account)
      return {
        ok: false,
        error: "Choose the account you paid from.",
        fieldErrors: { paidFromAccountId: "Choose an account." },
      };
    let newCode: NewCustomerCode = null;
    const result = await move(
      member,
      deal,
      "PAID_OUT",
      `Paid out from ${account.bank} ••${account.accountNumber.slice(-4)} · ref ${parsed.data.reference}`,
      {
        set: {
          payoutReference: parsed.data.reference,
          paidFromAccountId: account.id,
          ...(profit !== null && { profitNaira: profit }),
        },
        data: {
          reference: parsed.data.reference,
          paidFromAccountId: account.id,
        },
        after: async (tx) => {
          newCode = await recordProfitAndReward(tx, {
            dealId: deal.id,
            profit,
            membershipId: member.membershipId,
          });
        },
      },
    );
    if (result.ok) after(() => notifyPaidOut(deal.id));
    // The customer's own referral code, by email (after the response).
    const created = newCode as NewCustomerCode;
    if (result.ok && created) after(() => notifyReferralCode(deal.id, created));
    return result;
  },
);

// ── Flagged: confirm manually (reason required) ───────────────────────

const confirmInput = z.object({
  ref: z.string(),
  reason: z
    .string()
    .trim()
    .min(5, "Say what you checked, for the record.")
    .max(300),
});

export const confirmDepositManually = safeAction(
  async (
    member,
    raw: unknown,
  ): Promise<ActionResult<{ status: DealStatus }>> => {
    const parsed = confirmInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: "Say what you checked, for the record.",
        fieldErrors: { reason: parsed.error.issues[0]!.message },
      };
    const deal = await loadCryptoDeal(member.organizationId, parsed.data.ref);
    if (!deal) return NOT_FOUND;
    const now = new Date();
    return move(
      member,
      deal,
      "DEPOSIT_COMPLETE",
      `Deposit confirmed manually: ${parsed.data.reason}`,
      {
        set: {
          depositCompletedAt: now,
          payoutDueAt: new Date(
            now.getTime() + deal.organization.payoutTargetMinutes * 60_000,
          ),
          flagReason: null,
        },
        data: { reason: parsed.data.reason },
      },
    );
  },
);

// ── Expired or flagged: re-quote (new rate and lock, logged) ──────────

const requoteInput = z.object({
  ref: z.string(),
  rate: z
    .string()
    .transform((v) => v.trim().replace(/,/g, ""))
    .pipe(
      z
        .string()
        .regex(/^\d+(\.\d{1,4})?$/, "Enter the new rate, like 1590.")
        .refine((v) => Number(v) > 0, "Enter the new rate, like 1590."),
    ),
});

export const requoteCryptoDeal = safeAction(
  async (
    member,
    raw: unknown,
  ): Promise<ActionResult<{ status: DealStatus }>> => {
    const parsed = requoteInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: "Enter the new rate.",
        fieldErrors: { rate: parsed.error.issues[0]!.message },
      };
    const deal = await loadCryptoDeal(member.organizationId, parsed.data.ref);
    if (!deal || !deal.expectedQty) return NOT_FOUND;
    const now = new Date();
    const rate = parsed.data.rate;
    const naira = multiplyDecimalStrings(deal.expectedQty.toFixed(), rate);
    const lockExpiresAt = new Date(
      now.getTime() + deal.organization.rateLockMinutes * 60_000,
    );
    const previous = (deal.agreedRate ?? deal.quotedRate)?.toFixed() ?? null;
    return move(
      member,
      deal,
      "AWAITING_DEPOSIT",
      `Re-quoted at ₦${rate} per $1 · new ${deal.organization.rateLockMinutes} min lock`,
      {
        set: {
          agreedRate: rate,
          agreedNaira: naira,
          agreedAt: now,
          agreedById: member.membershipId,
          lockExpiresAt,
          flagReason: null,
          lastDepositCheckAt: null,
        },
        data: { from: previous, to: rate },
        events: [
          {
            dealId: deal.id,
            type: "RATE_CHANGED",
            message: `Rate changed from ₦${previous ?? "—"} to ₦${rate} per $1 (re-quote)`,
            data: { from: previous, to: rate, naira },
            actorType: "MEMBER",
            actorMembershipId: member.membershipId,
            createdAt: now,
          },
        ],
      },
    );
  },
);

// ── BTC: agree the payout after the price moved (RATE_TO_AGREE) ──────

const agreeInput = z.object({
  ref: z.string(),
  naira: z
    .string()
    .transform((v) => v.trim().replace(/[,₦\s]/g, ""))
    .pipe(
      z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, "Enter the agreed naira, like 520000.")
        .refine((v) => Number(v) > 0, "Enter the agreed naira, like 520000."),
    ),
  note: z
    .string()
    .trim()
    .min(3, "Say what you agreed, for the record.")
    .max(300),
});

export const agreeCryptoPayout = safeAction(
  async (
    member,
    raw: unknown,
  ): Promise<ActionResult<{ status: DealStatus }>> => {
    const parsed = agreeInput.safeParse(raw);
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
    const deal = await loadCryptoDeal(member.organizationId, parsed.data.ref);
    if (!deal) return NOT_FOUND;
    const now = new Date();
    const { naira, note } = parsed.data;
    return move(
      member,
      deal,
      "DEPOSIT_COMPLETE",
      `Payout agreed on WhatsApp: ${nairaText(naira)} (${note})`,
      {
        set: {
          agreedNaira: naira,
          agreedAt: now,
          agreedById: member.membershipId,
          depositCompletedAt: now,
          payoutDueAt: new Date(
            now.getTime() + deal.organization.payoutTargetMinutes * 60_000,
          ),
        },
        data: { naira, note },
        events: [
          {
            dealId: deal.id,
            type: "RATE_CHANGED",
            message: `Payout agreed at ${nairaText(naira)} after the price moved`,
            data: { naira, note },
            actorType: "MEMBER",
            actorMembershipId: member.membershipId,
            createdAt: now,
          },
        ],
      },
    );
  },
);

// ── Wallet balances and the ETH checker (admin) ───────────────────────

export const getWalletBalances = safeAction(
  async ({
    organizationId,
  }): Promise<
    ActionResult<{ walletId: string; balance: Balance; checkedAt: string }[]>
  > => {
    const wallets = await db.cryptoWallet.findMany({
      where: { organizationId, active: true },
      select: { id: true, network: true, address: true },
    });
    const rows = await Promise.all(
      wallets.map(async (w) => ({
        walletId: w.id,
        balance: await walletBalance(w.network, w.address),
        checkedAt: new Date().toISOString(),
      })),
    );
    return { ok: true, data: rows };
  },
);

export const checkEthTransferForTeam = safeAction(
  async ({ organizationId }, raw: unknown): Promise<ActionResult<EthCheck>> =>
    runEthCheck(organizationId, raw),
);
