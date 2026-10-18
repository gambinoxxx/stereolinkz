// The deal state machine (Invariant 15). Every status change goes through
// transitionDeal, in the caller's transaction, together with its
// DealEvent. Customers never move a status (they only add events). The
// system (the crypto deposit watcher) makes only the deposit moves;
// payment received, completed and paid out are always a team member's.
import type { DealActor, DealStatus, Prisma } from "@/generated/prisma/client";

type Mover = "MEMBER" | "SYSTEM";

// Allowed moves and who may make each one.
export const TRANSITIONS: Partial<
  Record<DealStatus, Partial<Record<DealStatus, Mover>>>
> = {
  // Non-crypto (Phase 12)
  NEW: { AGREED: "MEMBER", CANCELLED: "MEMBER" },
  AGREED: { AWAITING_PAYMENT: "MEMBER", CANCELLED: "MEMBER" },
  AWAITING_PAYMENT: { PAYMENT_RECEIVED: "MEMBER", CANCELLED: "MEMBER" },
  PAYMENT_RECEIVED: { PROCESSING: "MEMBER", COMPLETED: "MEMBER" },
  PROCESSING: { COMPLETED: "MEMBER" },
  // Crypto (Phase 13). The watcher sees, completes, expires and flags.
  AWAITING_DEPOSIT: {
    DEPOSIT_SEEN: "SYSTEM",
    EXPIRED: "SYSTEM",
    FLAGGED: "SYSTEM",
    CANCELLED: "MEMBER",
  },
  DEPOSIT_SEEN: {
    DEPOSIT_COMPLETE: "SYSTEM",
    FLAGGED: "SYSTEM",
    // Phase 13b: a market-priced deposit worth less than the payout.
    RATE_TO_AGREE: "SYSTEM",
  },
  // The team agrees the payout on WhatsApp, or cancels.
  RATE_TO_AGREE: { DEPOSIT_COMPLETE: "MEMBER", CANCELLED: "MEMBER" },
  DEPOSIT_COMPLETE: { PAID_OUT: "MEMBER" },
  // Re-quote (new rate and lock), flag a late deposit for a look, or cancel.
  EXPIRED: {
    AWAITING_DEPOSIT: "MEMBER",
    FLAGGED: "MEMBER",
    CANCELLED: "MEMBER",
  },
  // Confirm manually (reason required), cancel (reason) or re-quote.
  FLAGGED: {
    DEPOSIT_COMPLETE: "MEMBER",
    CANCELLED: "MEMBER",
    AWAITING_DEPOSIT: "MEMBER",
  },
};

export function moverFor(from: DealStatus, to: DealStatus): Mover | null {
  return TRANSITIONS[from]?.[to] ?? null;
}

export function canTransition(from: DealStatus, to: DealStatus): boolean {
  return moverFor(from, to) !== null;
}

export type DealActorRef =
  | { type: "MEMBER"; membershipId: string }
  | { type: Exclude<DealActor, "MEMBER"> };

export class DealTransitionError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_ALLOWED" | "ACTOR" | "CHANGED",
  ) {
    super(message);
    this.name = "DealTransitionError";
  }
}

// The writes transitionDeal needs, so tests can pass a fake transaction.
export type TransitionTx = {
  deal: Pick<Prisma.TransactionClient["deal"], "updateMany">;
  dealEvent: Pick<Prisma.TransactionClient["dealEvent"], "create">;
};

export type TransitionOptions = {
  message: string; // the activity line: "Payment received: ₦8,262,000 checked on the statement"
  data?: Prisma.InputJsonValue; // extra event detail
  set?: Omit<
    Prisma.DealUncheckedUpdateManyInput,
    "status" | "statusChangedAt" | "id" | "organizationId"
  >; // fields that change with the status
  now?: Date;
};

export async function transitionDeal(
  tx: TransitionTx,
  deal: { id: string; status: DealStatus },
  to: DealStatus,
  actor: DealActorRef,
  { message, data, set, now = new Date() }: TransitionOptions,
): Promise<void> {
  const mover = moverFor(deal.status, to);
  if (!mover)
    throw new DealTransitionError(
      `A deal can't move from ${deal.status} to ${to}.`,
      "NOT_ALLOWED",
    );
  if (actor.type !== mover)
    throw new DealTransitionError(
      mover === "MEMBER"
        ? "Only a team member can change a deal's status."
        : "Only the deposit check can make this change.",
      "ACTOR",
    );

  // Conditional on the status the caller saw: if two people act at once,
  // the second finds nothing to update and nothing is written.
  const { count } = await tx.deal.updateMany({
    where: { id: deal.id, status: deal.status },
    data: { ...set, status: to, statusChangedAt: now },
  });
  if (count !== 1)
    throw new DealTransitionError(
      "This deal has just changed. Reload to see its latest status.",
      "CHANGED",
    );

  await tx.dealEvent.create({
    data: {
      dealId: deal.id,
      type: "STATUS_CHANGED",
      fromStatus: deal.status,
      toStatus: to,
      message,
      data,
      actorType: actor.type,
      actorMembershipId: actor.type === "MEMBER" ? actor.membershipId : null,
      createdAt: now,
    },
  });
}
