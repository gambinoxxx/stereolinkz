// The deal state machine (Invariant 15). Every status change goes through
// transitionDeal, in the caller's transaction, together with its
// DealEvent. Customers never move a status (they only add events), and in
// Phase 12 neither does the system: payment received and completed are
// always set by a team member after checking the bank statement.
import type { DealActor, DealStatus, Prisma } from "@/generated/prisma/client";

// Allowed moves for non-crypto deals. Crypto statuses arrive in Phase 13,
// where the deposit watcher (actor SYSTEM) gets its own rows here.
export const TRANSITIONS: Partial<Record<DealStatus, readonly DealStatus[]>> = {
  NEW: ["AGREED", "CANCELLED"],
  AGREED: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["PAYMENT_RECEIVED", "CANCELLED"],
  PAYMENT_RECEIVED: ["PROCESSING", "COMPLETED"],
  PROCESSING: ["COMPLETED"],
};

export function canTransition(from: DealStatus, to: DealStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
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
  if (!canTransition(deal.status, to))
    throw new DealTransitionError(
      `A deal can't move from ${deal.status} to ${to}.`,
      "NOT_ALLOWED",
    );
  if (actor.type !== "MEMBER")
    throw new DealTransitionError(
      "Only a team member can change a deal's status.",
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
      actorMembershipId: actor.membershipId,
      createdAt: now,
    },
  });
}
