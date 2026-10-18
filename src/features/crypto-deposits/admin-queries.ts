import "server-only";

// What the team sees for crypto (deal-detail-crypto.html, deals.html):
// the deposit check worked out again from the stored transfer, the payout
// timer, wallets for Settings and unmatched transfers. Scoped by org.
import { checkDeposit, type CheckKey } from "@/features/crypto-deposits/check";
import {
  DEALABLE_TOKENS,
  NETWORKS,
  OFFICIAL_TOKENS,
} from "@/features/crypto-deposits/tokens";
import type { CryptoNetwork } from "@/generated/prisma/client";
import { db } from "@/lib/server/db";

export type TeamCrypto = {
  ticker: string;
  network: CryptoNetwork;
  depositAddress: string;
  expectedQty: string;
  receivedQty: string | null;
  txHash: string | null;
  explorerTx: string | null;
  confirmations: number | null;
  minConfirmations: number;
  lockMinutes: number;
  lockExpiresAt: string;
  depositSeenAt: string | null;
  depositCompletedAt: string | null;
  payoutDueAt: string | null;
  payoutMinutes: number;
  flagReason: string | null;
  // Null until a transfer is linked. Values for the panel's right column.
  checks: Record<CheckKey, boolean> | null;
  transfer: {
    toAddress: string;
    tokenContract: string;
    amount: string;
    blockTime: string;
    network: CryptoNetwork;
  } | null;
  officialContract: string | null;
};

export async function getCryptoForTeam(
  organizationId: string,
  dealId: string,
): Promise<TeamCrypto | null> {
  const d = await db.deal.findFirst({
    where: { id: dealId, organizationId, service: "CRYPTO_SELL" },
    select: {
      cryptoTicker: true,
      cryptoNetwork: true,
      depositAddress: true,
      expectedQty: true,
      receivedQty: true,
      txHash: true,
      confirmations: true,
      lockExpiresAt: true,
      depositSeenAt: true,
      depositCompletedAt: true,
      payoutDueAt: true,
      flagReason: true,
      createdAt: true,
      wallet: { select: { minConfirmations: true } },
      matchedTransfer: true,
      organization: {
        select: { rateLockMinutes: true, payoutTargetMinutes: true },
      },
    },
  });
  if (
    !d ||
    !d.cryptoTicker ||
    !d.cryptoNetwork ||
    !d.depositAddress ||
    !d.expectedQty ||
    !d.lockExpiresAt
  )
    return null;
  const t = d.matchedTransfer;
  const minConfirmations = d.wallet?.minConfirmations ?? 1;
  const checks = t
    ? checkDeposit(
        {
          network: d.cryptoNetwork,
          ticker: d.cryptoTicker,
          depositAddress: d.depositAddress,
          expectedQty: d.expectedQty.toFixed(),
          lockExpiresAt: d.lockExpiresAt,
        },
        {
          network: t.network,
          toAddress: t.toAddress,
          tokenContract: t.tokenContract,
          amount: t.amount.toFixed(),
          blockTime: t.blockTime,
          confirmations: t.confirmations,
        },
        minConfirmations,
      ).checks
    : null;
  const official =
    OFFICIAL_TOKENS.find(
      (o) => o.network === d.cryptoNetwork && o.ticker === d.cryptoTicker,
    )?.contract ?? null;
  const txHash = d.txHash ?? t?.txHash ?? null;
  return {
    ticker: d.cryptoTicker,
    network: d.cryptoNetwork,
    depositAddress: d.depositAddress,
    expectedQty: d.expectedQty.toFixed(),
    receivedQty: (d.receivedQty ?? t?.amount)?.toFixed() ?? null,
    txHash,
    explorerTx: txHash ? NETWORKS[d.cryptoNetwork].explorerTx(txHash) : null,
    confirmations: d.confirmations ?? t?.confirmations ?? null,
    minConfirmations,
    lockMinutes: d.organization.rateLockMinutes,
    lockExpiresAt: d.lockExpiresAt.toISOString(),
    depositSeenAt: d.depositSeenAt?.toISOString() ?? null,
    depositCompletedAt: d.depositCompletedAt?.toISOString() ?? null,
    payoutDueAt: d.payoutDueAt?.toISOString() ?? null,
    payoutMinutes: d.organization.payoutTargetMinutes,
    flagReason: d.flagReason,
    checks,
    transfer: t
      ? {
          toAddress: t.toAddress,
          tokenContract: t.tokenContract,
          amount: t.amount.toFixed(),
          blockTime: t.blockTime.toISOString(),
          network: t.network,
        }
      : null,
    officialContract: official,
  };
}

// Transfers of an official token to our wallets that no deal took, from
// the last 7 days (other tokens are ignored: anyone can send junk tokens).
export async function countUnmatchedDeposits(organizationId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  return db.observedTransfer.count({
    where: {
      organizationId,
      matchedDealId: null,
      blockTime: { gte: since },
      OR: DEALABLE_TOKENS.map((o) => ({
        network: o.network,
        tokenContract: o.contract,
      })),
    },
  });
}

export async function listUnmatchedDeposits(organizationId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const rows = await db.observedTransfer.findMany({
    where: {
      organizationId,
      matchedDealId: null,
      blockTime: { gte: since },
      OR: DEALABLE_TOKENS.map((o) => ({
        network: o.network,
        tokenContract: o.contract,
      })),
    },
    orderBy: { blockTime: "desc" },
    take: 50,
    select: {
      id: true,
      network: true,
      txHash: true,
      fromAddress: true,
      tokenContract: true,
      amount: true,
      blockTime: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    ticker:
      OFFICIAL_TOKENS.find(
        (o) => o.network === r.network && o.contract === r.tokenContract,
      )?.ticker ?? "?",
    amount: r.amount.toFixed(),
    blockTime: r.blockTime.toISOString(),
    explorerTx: NETWORKS[r.network].explorerTx(r.txHash),
  }));
}

// Crypto deals whose payout is due: complete, not yet paid out.
export async function countPayoutsDue(organizationId: string) {
  return db.deal.count({
    where: { organizationId, status: "DEPOSIT_COMPLETE" },
  });
}
