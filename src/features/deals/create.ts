import "server-only";

// Creating a deal, for the website (public-actions.ts) and for the team's
// "New deal" (actions.ts). One transaction: the org's reference counter is
// incremented (the row lock makes parallel creates wait their turn, so no
// two deals share a reference), then the deal and its first event are
// inserted. Nothing is written unless all three succeed.
import type { Quote } from "@/features/deals/quote";
import { formatRef } from "@/features/deals/refs";
import type { DealDetails } from "@/features/deals/schema";
import type { DealActorRef } from "@/features/deals/transitions";
import type { DealService, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/server/db";

export type NewDeal = {
  organizationId: string;
  service: DealService;
  customer: { name: string; whatsapp: string; email?: string };
  details: DealDetails;
  currency: string;
  amount: string;
  quote: Quote | null;
  payout?: { bank: string; accountNumber: string; accountName?: string };
  ownerMembershipId: string | null;
  trackingTokenHash: string;
  ipHash: string | null;
  actor: DealActorRef;
  message: string; // "Requested on the website" / "Added by the team"
  now?: Date;
};

type Tx = Prisma.TransactionClient;

// Exposed for tests: the writes inside the transaction.
export async function insertDeal(
  tx: Tx,
  input: NewDeal,
): Promise<{ id: string; ref: string }> {
  const now = input.now ?? new Date();
  const org = await tx.organization.update({
    where: { id: input.organizationId },
    data: { dealRefCounter: { increment: 1 } },
    select: { dealRefCounter: true, dealRefPrefix: true },
  });
  const ref = formatRef(org.dealRefPrefix, org.dealRefCounter);
  const { quote } = input;
  const deal = await tx.deal.create({
    data: {
      organizationId: input.organizationId,
      ref,
      service: input.service,
      status: "NEW",
      customerName: input.customer.name,
      customerWhatsapp: input.customer.whatsapp,
      customerEmail: input.customer.email ?? null,
      details: input.details,
      currency: input.currency,
      amount: input.amount,
      quotedRate: quote?.rate ?? null,
      quotedNaira: quote?.naira ?? null,
      quotedBoardId: quote?.boardId ?? null,
      quotedAt: quote ? now : null,
      payoutBank: input.payout?.bank ?? null,
      payoutAccountNumber: input.payout?.accountNumber ?? null,
      payoutAccountName: input.payout?.accountName ?? null,
      ownerMembershipId: input.ownerMembershipId,
      trackingTokenHash: input.trackingTokenHash,
      ipHash: input.ipHash,
      statusChangedAt: now,
      createdAt: now,
    },
    select: { id: true },
  });
  await tx.dealEvent.create({
    data: {
      dealId: deal.id,
      type: "REQUESTED",
      toStatus: "NEW",
      message: input.message,
      data: quote
        ? {
            quote: {
              rate: quote.rate,
              naira: quote.naira,
              boardId: quote.boardId,
              timeLabel: quote.timeLabel,
            },
          }
        : { quote: null },
      actorType: input.actor.type,
      actorMembershipId:
        input.actor.type === "MEMBER" ? input.actor.membershipId : null,
      createdAt: now,
    },
  });
  return { id: deal.id, ref };
}

// Parallel creates queue on the counter's row lock, so allow a wait. The
// transaction itself is three short writes (uploads happen after it).
export function createDeal(input: NewDeal) {
  return db.$transaction((tx) => insertDeal(tx, input), {
    maxWait: 10_000,
    timeout: 15_000,
  });
}
