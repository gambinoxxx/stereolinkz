import "server-only";

// The customer's view of a crypto deal (Invariant 14), after the tracking
// token matched. Customer-safe fields only: never the flag reason, notes,
// staff, phone or email. Our deposit address only while the deal is
// waiting for a deposit inside its rate lock.
import type { CryptoNetwork, DealStatus } from "@/generated/prisma/client";
import { db } from "@/lib/server/db";

export type CustomerCryptoDeal = {
  ref: string;
  status: DealStatus;
  customerName: string;
  hasEmail: boolean;
  ticker: string;
  network: CryptoNetwork;
  expectedQty: string;
  rate: string; // naira per $1: the re-quoted rate if any, else the locked one
  naira: string; // exact
  createdAt: string;
  lockExpiresAt: string;
  lockMinutes: number;
  lockOpen: boolean; // waiting, and the lock hasn't ended
  depositAddress: string | null; // only while lockOpen
  minConfirmations: number;
  confirmations: number | null;
  receivedQty: string | null;
  txHash: string | null;
  depositSeenAt: string | null;
  depositCompletedAt: string | null;
  payoutDueAt: string | null;
  payoutMinutes: number;
  payout: { bank: string; last4: string; name: string };
  paid: { reference: string; at: string } | null;
};

export async function getCryptoDealForCustomer(
  dealId: string,
  now = new Date(),
): Promise<CustomerCryptoDeal | null> {
  const d = await db.deal.findUnique({
    where: { id: dealId },
    select: {
      ref: true,
      service: true,
      status: true,
      customerName: true,
      customerEmail: true,
      cryptoTicker: true,
      cryptoNetwork: true,
      depositAddress: true,
      expectedQty: true,
      quotedRate: true,
      quotedNaira: true,
      agreedRate: true,
      agreedNaira: true,
      createdAt: true,
      lockExpiresAt: true,
      confirmations: true,
      receivedQty: true,
      txHash: true,
      depositSeenAt: true,
      depositCompletedAt: true,
      payoutDueAt: true,
      payoutBank: true,
      payoutAccountNumber: true,
      payoutAccountName: true,
      payoutReference: true,
      wallet: { select: { minConfirmations: true } },
      organization: {
        select: { rateLockMinutes: true, payoutTargetMinutes: true },
      },
      events: {
        where: { type: "STATUS_CHANGED", toStatus: "PAID_OUT" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  if (
    !d ||
    d.service !== "CRYPTO_SELL" ||
    !d.cryptoTicker ||
    !d.cryptoNetwork ||
    !d.expectedQty ||
    !d.lockExpiresAt ||
    !d.quotedRate ||
    !d.quotedNaira
  )
    return null;

  const waiting =
    d.status === "AWAITING_DEPOSIT" || d.status === "DEPOSIT_SEEN";
  const lockOpen =
    d.status === "DEPOSIT_SEEN" ||
    (d.status === "AWAITING_DEPOSIT" && d.lockExpiresAt > now);
  const seen = d.status !== "AWAITING_DEPOSIT" && d.depositSeenAt !== null;
  const paidAt = d.events[0]?.createdAt;
  return {
    ref: d.ref,
    status: d.status,
    customerName: d.customerName,
    hasEmail: !!d.customerEmail,
    ticker: d.cryptoTicker,
    network: d.cryptoNetwork,
    expectedQty: d.expectedQty.toFixed(2),
    rate: (d.agreedRate ?? d.quotedRate).toFixed(),
    naira: (d.agreedNaira ?? d.quotedNaira).toFixed(),
    createdAt: d.createdAt.toISOString(),
    lockExpiresAt: d.lockExpiresAt.toISOString(),
    lockMinutes: d.organization.rateLockMinutes,
    lockOpen,
    depositAddress: waiting && lockOpen ? d.depositAddress : null,
    minConfirmations: d.wallet?.minConfirmations ?? 1,
    confirmations: seen ? d.confirmations : null,
    receivedQty: seen ? (d.receivedQty?.toFixed() ?? null) : null,
    txHash: seen ? d.txHash : null,
    depositSeenAt: d.depositSeenAt?.toISOString() ?? null,
    depositCompletedAt: d.depositCompletedAt?.toISOString() ?? null,
    payoutDueAt: d.payoutDueAt?.toISOString() ?? null,
    payoutMinutes: d.organization.payoutTargetMinutes,
    payout: {
      bank: d.payoutBank ?? "",
      last4: (d.payoutAccountNumber ?? "").slice(-4),
      name: d.payoutAccountName ?? d.customerName,
    },
    paid:
      d.status === "PAID_OUT" && d.payoutReference && paidAt
        ? { reference: d.payoutReference, at: paidAt.toISOString() }
        : null,
  };
}
