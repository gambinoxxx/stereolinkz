// What one deposit check should do to one deal (pure). The watcher reads
// the deal, its linked transfer and the chain's proof, then applies the
// plan through transitionDeal, each move conditional on the status read.
// Planning again after applying gives an empty plan (idempotent).
import type { DealStatus } from "@/generated/prisma/client";
import {
  checkDeposit,
  type CheckDeal,
  type CheckTransfer,
} from "@/features/crypto-deposits/check";
import type { TransferProof } from "@/features/crypto-deposits/providers/types";

export const SEEN_STALL_MINUTES = 60; // seen but never confirmed → team looks

export type PlanDeal = CheckDeal & {
  id: string;
  status: DealStatus;
  depositSeenAt: Date | null;
  confirmations: number | null;
  payoutTargetMinutes: number;
};

export type PlanTransfer = CheckTransfer & { txHash: string };

export type Step = {
  to: DealStatus;
  message: string;
  set: {
    depositSeenAt?: Date;
    depositCompletedAt?: Date;
    payoutDueAt?: Date;
    txHash?: string;
    receivedQty?: string;
    confirmations?: number;
    flagReason?: string;
  };
  data?: Record<string, string | number | null>;
};

export type DealPlan = {
  steps: Step[]; // applied in order, each from the previous status
  confirmations: number | null; // a quiet update while seen (no event)
  note: string | null; // an event without a status change
};

const EMPTY: DealPlan = { steps: [], confirmations: null, note: null };
const flag = (reason: string): Step => ({
  to: "FLAGGED",
  message: "Flagged for the team",
  set: { flagReason: reason },
  data: { reason },
});

export function planDeal(
  deal: PlanDeal,
  linked: { transfer: PlanTransfer; proof: TransferProof } | null,
  minConfirmations: number,
  now: Date,
  forcedFlag: string | null = null,
): DealPlan {
  const open =
    deal.status === "AWAITING_DEPOSIT" || deal.status === "DEPOSIT_SEEN";

  if (!linked) {
    if (deal.status === "AWAITING_DEPOSIT" && now > deal.lockExpiresAt)
      return {
        ...EMPTY,
        steps: [
          {
            to: "EXPIRED",
            message: "Rate lock ended with no deposit",
            set: {},
          },
        ],
      };
    return EMPTY;
  }

  const { transfer, proof } = linked;
  if (deal.status === "EXPIRED")
    // Linked after the lock ended: the team re-quotes (once; the watcher
    // only calls this for a new link).
    return {
      ...EMPTY,
      note: `Late deposit seen: ${transfer.amount} ${deal.ticker}`,
    };
  if (!open) return EMPTY;
  if (forcedFlag) return { ...EMPTY, steps: [flag(forcedFlag)] };
  if (proof.state === "FAILED")
    return { ...EMPTY, steps: [flag(proof.reason)] };

  const confirmations = proof.state === "IN_BLOCK" ? proof.confirmations : 0;
  const { verdict } = checkDeposit(
    deal,
    { ...transfer, confirmations },
    minConfirmations,
  );
  const seenStep: Step = {
    to: "DEPOSIT_SEEN",
    message: `Deposit seen: ${transfer.amount} ${deal.ticker}`,
    set: {
      depositSeenAt: now,
      txHash: transfer.txHash,
      receivedQty: transfer.amount,
      confirmations,
    },
    data: { txHash: transfer.txHash, confirmations },
  };

  switch (verdict.outcome) {
    case "FLAGGED":
      return { ...EMPTY, steps: [flag(verdict.reason)] };
    case "EXPIRED":
      // A seen deal can't expire; its late arrival goes to the team.
      return {
        ...EMPTY,
        steps: [
          deal.status === "AWAITING_DEPOSIT"
            ? {
                to: "EXPIRED",
                message: "Deposit arrived after the rate lock ended",
                set: {
                  flagReason: verdict.reason,
                  txHash: transfer.txHash,
                  receivedQty: transfer.amount,
                },
                data: { reason: verdict.reason },
              }
            : flag(verdict.reason),
        ],
      };
    case "SEEN": {
      if (deal.status === "AWAITING_DEPOSIT")
        return { ...EMPTY, steps: [seenStep] };
      const since = deal.depositSeenAt ?? now;
      if (now.getTime() - since.getTime() > SEEN_STALL_MINUTES * 60_000)
        return {
          ...EMPTY,
          steps: [flag(`confirmations stalled at ${confirmations}`)],
        };
      return {
        ...EMPTY,
        confirmations:
          confirmations !== deal.confirmations ? confirmations : null,
      };
    }
    case "COMPLETE": {
      const complete: Step = {
        to: "DEPOSIT_COMPLETE",
        message: verdict.overpaidBy
          ? `Deposit complete: ${transfer.amount} ${deal.ticker} (${verdict.overpaidBy} more than expected)`
          : `Deposit complete: ${transfer.amount} ${deal.ticker}`,
        set: {
          depositCompletedAt: now,
          payoutDueAt: new Date(
            now.getTime() + deal.payoutTargetMinutes * 60_000,
          ),
          txHash: transfer.txHash,
          receivedQty: transfer.amount,
          confirmations,
        },
        data: {
          txHash: transfer.txHash,
          confirmations,
          overpaidBy: verdict.overpaidBy,
        },
      };
      return {
        ...EMPTY,
        steps:
          deal.status === "AWAITING_DEPOSIT"
            ? [seenStep, complete]
            : [complete],
      };
    }
  }
}
