import "server-only";

// Creating a deal, for the website (public-actions.ts) and for the team's
// "New deal" (actions.ts). One transaction: the org's reference counter is
// incremented (the row lock makes parallel creates wait their turn, so no
// two deals share a reference), then the deal and its first event are
// inserted. Nothing is written unless all three succeed.
import {
  btcToSats,
  satsToBtc,
  uniqueAmount,
  uniqueSats,
} from "@/features/crypto-deposits/amounts";
import type { Quote } from "@/features/deals/quote";
import { type CodeRow, decideAttach } from "@/features/referrals/attach";
import { formatRef } from "@/features/deals/refs";
import type { DealDetails } from "@/features/deals/schema";
import type { DealActorRef } from "@/features/deals/transitions";
import type {
  CryptoNetwork,
  DealService,
  Prisma,
} from "@/generated/prisma/client";
import { multiplyDecimalStrings } from "@/lib/decimal";
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
  // Website only: checked inside the transaction, after the counter row
  // is locked, so parallel submits can't slip past the limit together.
  limits?: { perIpPerHour: number; openPerPhone: number };
  // Crypto (Phase 13): the deal starts at AWAITING_DEPOSIT with a copy of
  // the wallet's address, the exact amount to send (unique per wallet) and
  // the rate lock. `amount` is the amount typed; `quote` is replaced by
  // the rate × the exact amount.
  crypto?: {
    walletId: string;
    ticker: string;
    network: CryptoNetwork;
    depositAddress: string;
    rate: string;
    boardId: string;
    timeLabel: string;
    lockMinutes: number;
    // Market-priced coins (BTC): the dollar quote; `amount` is then the
    // coins at the live price, before the unique satoshis are added.
    market?: {
      quoteUsd: string;
      feeUsd: string;
      payoutUsd: string;
      priceUsd: string;
    };
  };
  // Referral (Phase 13c): a code already checked (checkCode); the fraud and
  // new-customer rules run in the transaction, and the outcome is logged.
  referral?: { code: CodeRow; newCustomersOnly: boolean };
  now?: Date;
};

// Website submits: 5 new deals per IP per hour, 3 open deals per number.
export const WEBSITE_LIMITS = { perIpPerHour: 5, openPerPhone: 3 } as const;

// Statuses that count as "open" for the per-phone limit.
export const OPEN_STATUSES = [
  "NEW",
  "AGREED",
  "AWAITING_PAYMENT",
  "PAYMENT_RECEIVED",
  "PROCESSING",
  "AWAITING_DEPOSIT",
  "DEPOSIT_SEEN",
  "DEPOSIT_COMPLETE",
  "FLAGGED",
] as const;

// Every cents suffix for this amount is in use on the wallet right now.
export class CryptoAmountBusyError extends Error {
  constructor() {
    super("No free amount on this wallet");
    this.name = "CryptoAmountBusyError";
  }
}

// Deals whose expected amount a new transfer could still match
// (crypto-deposits/match.ts: waiting deals, and expired ones for 3 days).
async function takenAmounts(tx: Tx, walletId: string, now: Date) {
  const rows = await tx.deal.findMany({
    where: {
      walletId,
      matchedTransfer: null,
      OR: [
        { status: { in: ["AWAITING_DEPOSIT", "DEPOSIT_SEEN"] } },
        {
          status: "EXPIRED",
          createdAt: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60_000) },
        },
      ],
    },
    select: { expectedQty: true },
  });
  return rows.flatMap((r) => (r.expectedQty ? [r.expectedQty.toFixed()] : []));
}

export class DealRateLimitError extends Error {
  constructor(readonly reason: "ip" | "phone") {
    super(`Deal rate limit (${reason})`);
    this.name = "DealRateLimitError";
  }
}

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
  if (input.limits) {
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const [fromIp, openForPhone] = await Promise.all([
      input.ipHash
        ? tx.deal.count({
            where: { ipHash: input.ipHash, createdAt: { gt: hourAgo } },
          })
        : Promise.resolve(0),
      tx.deal.count({
        where: {
          organizationId: input.organizationId,
          customerWhatsapp: input.customer.whatsapp,
          status: { in: [...OPEN_STATUSES] },
        },
      }),
    ]);
    // Throwing rolls the counter back too.
    if (fromIp >= input.limits.perIpPerHour) throw new DealRateLimitError("ip");
    if (openForPhone >= input.limits.openPerPhone)
      throw new DealRateLimitError("phone");
  }
  const ref = formatRef(org.dealRefPrefix, org.dealRefCounter);
  const { crypto } = input;
  let quote = input.quote;
  let expectedQty: string | null = null;
  if (crypto) {
    // Lock the wallet row so two deals can't pick the same amount.
    await tx.$queryRaw`SELECT id FROM "CryptoWallet" WHERE id = ${crypto.walletId} FOR UPDATE`;
    const taken = await takenAmounts(tx, crypto.walletId, now);
    if (crypto.market) {
      const sats = uniqueSats(btcToSats(input.amount), taken.map(btcToSats));
      expectedQty = sats === null ? null : satsToBtc(sats);
    } else expectedQty = uniqueAmount(input.amount, taken);
    if (!expectedQty) throw new CryptoAmountBusyError();
    quote = {
      rate: crypto.rate,
      // Stablecoins: coins × rate. BTC: the payout dollars × rate.
      naira: multiplyDecimalStrings(
        crypto.market ? crypto.market.payoutUsd : expectedQty,
        crypto.rate,
      ),
      boardId: crypto.boardId,
      timeLabel: crypto.timeLabel,
      dateLabel: "",
      side: "buy",
    };
  }
  const status = crypto ? "AWAITING_DEPOSIT" : "NEW";
  const referral = input.referral
    ? await decideAttach(tx, {
        organizationId: input.organizationId,
        code: input.referral.code,
        customerWhatsapp: input.customer.whatsapp,
        newCustomersOnly: input.referral.newCustomersOnly,
      })
    : null;
  const deal = await tx.deal.create({
    data: {
      organizationId: input.organizationId,
      ref,
      service: input.service,
      status,
      customerName: input.customer.name,
      customerWhatsapp: input.customer.whatsapp,
      customerEmail: input.customer.email ?? null,
      details: input.details,
      currency: input.currency,
      amount: expectedQty ?? input.amount, // crypto: the exact amount to send
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
      referralCodeId: referral?.attach ? input.referral!.code.id : null,
      statusChangedAt: now,
      createdAt: now,
      ...(crypto && {
        cryptoTicker: crypto.ticker,
        cryptoNetwork: crypto.network,
        depositAddress: crypto.depositAddress,
        walletId: crypto.walletId,
        expectedQty,
        lockExpiresAt: new Date(now.getTime() + crypto.lockMinutes * 60_000),
        ...(crypto.market && {
          quoteUsd: crypto.market.quoteUsd,
          feeUsd: crypto.market.feeUsd,
          payoutUsd: crypto.market.payoutUsd,
          quotePrice: crypto.market.priceUsd,
        }),
      }),
    },
    select: { id: true },
  });
  await tx.dealEvent.create({
    data: {
      dealId: deal.id,
      type: "REQUESTED",
      toStatus: status,
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
  if (referral)
    await tx.dealEvent.create({
      data: {
        dealId: deal.id,
        type: "REFERRAL",
        message: referral.message,
        data: { code: input.referral!.code.code, applied: referral.attach },
        actorType: input.actor.type,
        actorMembershipId:
          input.actor.type === "MEMBER" ? input.actor.membershipId : null,
        // Just after REQUESTED, so the activity reads in order.
        createdAt: new Date(now.getTime() + 1),
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
