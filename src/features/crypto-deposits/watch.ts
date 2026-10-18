import "server-only";

// The deposit watcher: reads the transfers arriving at one of our wallets,
// records them, matches them to deals and moves each deal through
// transitionDeal as actor SYSTEM. Safe to run twice at once (the cron and
// a customer's page): every link and move is conditional on the state it
// read, so the second run finds nothing to do.
import { Prisma } from "@/generated/prisma/client";
import type { CryptoNetwork, DealStatus } from "@/generated/prisma/client";
import {
  claimByTxId,
  matchByAmount,
  type MatchDeal,
  type MatchTransfer,
} from "@/features/crypto-deposits/match";
import { planDeal, type PlanTransfer } from "@/features/crypto-deposits/plan";
import { tronProvider } from "@/features/crypto-deposits/providers/tron";
import type {
  DepositProvider,
  IncomingTransfer,
  TransferProof,
} from "@/features/crypto-deposits/providers/types";
import { OFFICIAL_TOKENS } from "@/features/crypto-deposits/tokens";
import {
  DealTransitionError,
  transitionDeal,
} from "@/features/deals/transitions";
import { db } from "@/lib/server/db";

export const OPEN_CRYPTO: DealStatus[] = ["AWAITING_DEPOSIT", "DEPOSIT_SEEN"];
const LATE_WINDOW_MS = 3 * 24 * 60 * 60_000; // expired deals still linkable
const OVERLAP_MS = 10 * 60_000;

export function providerFor(network: CryptoNetwork): DepositProvider | null {
  const decimalsFor = (contract: string) =>
    OFFICIAL_TOKENS.find(
      (t) => t.network === network && t.contract === contract,
    )?.decimals ?? null;
  switch (network) {
    case "TRC20":
      return tronProvider({ decimalsFor });
    case "BEP20":
      return null; // not enabled (tokens.ts)
    case "BTC":
      return null; // Phase 13b: added with the BTC provider
    case "ETH":
      return null; // never a deal: checker and balances only
  }
}

export type TxClaim = { dealId: string; txHash: string };
export type ClaimResult = "LINKED" | "NOT_FOUND" | "TAKEN" | "HAS_TRANSFER";

export type CheckSummary = {
  completed: string[]; // deal ids that reached DEPOSIT_COMPLETE (for alerts)
  claim: ClaimResult | null;
};

const dealSelect = {
  id: true,
  status: true,
  createdAt: true,
  cryptoNetwork: true,
  cryptoTicker: true,
  depositAddress: true,
  expectedQty: true,
  lockExpiresAt: true,
  depositSeenAt: true,
  confirmations: true,
  matchedTransfer: { select: { id: true } },
  organization: { select: { payoutTargetMinutes: true } },
} satisfies Prisma.DealSelect;
type WatchedDeal = Prisma.DealGetPayload<{ select: typeof dealSelect }>;

function toMatchDeal(d: WatchedDeal): MatchDeal {
  return {
    id: d.id,
    status: d.status,
    network: d.cryptoNetwork!,
    ticker: d.cryptoTicker!,
    depositAddress: d.depositAddress!,
    expectedQty: d.expectedQty!.toFixed(),
    createdAt: d.createdAt,
    hasTransfer: d.matchedTransfer !== null,
  };
}

type TransferRow = Prisma.ObservedTransferGetPayload<object>;
function toMatchTransfer(t: TransferRow): MatchTransfer {
  return {
    id: t.id,
    network: t.network,
    toAddress: t.toAddress,
    tokenContract: t.tokenContract,
    amount: t.amount.toFixed(),
    blockTime: t.blockTime,
    matchedDealId: t.matchedDealId,
  };
}

// Link a transfer to a deal only if both are still free.
async function link(transferId: string, dealId: string): Promise<boolean> {
  try {
    const { count } = await db.observedTransfer.updateMany({
      where: { id: transferId, matchedDealId: null },
      data: { matchedDealId: dealId },
    });
    return count === 1;
  } catch (error) {
    // The deal got a transfer from a parallel run (matchedDealId unique).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return false;
    throw error;
  }
}

async function flagSystem(deal: WatchedDeal, reason: string) {
  if (deal.status !== "AWAITING_DEPOSIT" && deal.status !== "DEPOSIT_SEEN")
    return;
  await db
    .$transaction((tx) =>
      transitionDeal(
        tx,
        deal,
        "FLAGGED",
        { type: "SYSTEM" },
        {
          message: "Flagged for the team",
          data: { reason },
          set: { flagReason: reason },
        },
      ),
    )
    .catch(ignoreChanged);
}

function ignoreChanged(error: unknown) {
  if (error instanceof DealTransitionError && error.code === "CHANGED") return;
  throw error;
}

export async function checkDeposits(
  walletId: string,
  {
    provider: given,
    now = new Date(),
    claim,
  }: { provider?: DepositProvider; now?: Date; claim?: TxClaim } = {},
): Promise<CheckSummary> {
  const wallet = await db.cryptoWallet.findUniqueOrThrow({
    where: { id: walletId },
  });
  const provider = given ?? providerFor(wallet.network);
  if (!provider) return { completed: [], claim: null };

  const loadDeals = () =>
    db.deal.findMany({
      where: {
        walletId,
        OR: [
          { status: { in: OPEN_CRYPTO } },
          {
            status: "EXPIRED",
            matchedTransfer: null,
            createdAt: { gte: new Date(now.getTime() - LATE_WINDOW_MS) },
          },
        ],
      },
      select: dealSelect,
    });
  let deals = await loadDeals();
  if (deals.length === 0) {
    await db.cryptoWallet.update({
      where: { id: walletId },
      data: { lastCheckedAt: now },
    });
    return { completed: [], claim: claim ? "NOT_FOUND" : null };
  }

  // 1. Record the transfers since the last successful check (with an
  // overlap), or since the oldest deal on a first check. Matching then
  // reads every recorded transfer since the oldest deal from the database.
  const oldest = new Date(
    Math.min(...deals.map((d) => d.createdAt.getTime())) - OVERLAP_MS,
  );
  const fetchFrom = wallet.lastCheckedAt
    ? new Date(
        Math.max(oldest.getTime(), wallet.lastCheckedAt.getTime() - OVERLAP_MS),
      )
    : oldest;
  let incoming: IncomingTransfer[];
  try {
    incoming = await provider.listIncomingTransfers(wallet.address, fetchFrom);
  } catch (error) {
    await db.cryptoWallet.update({
      where: { id: walletId },
      data: { lastFailedAt: now },
    });
    throw error;
  }
  if (incoming.length > 0)
    await db.observedTransfer.createMany({
      data: incoming.map((t) => ({
        organizationId: wallet.organizationId,
        walletId,
        network: t.network,
        txHash: t.txHash,
        logIndex: t.logIndex,
        fromAddress: t.fromAddress,
        toAddress: t.toAddress,
        tokenContract: t.tokenContract,
        amount: t.amount,
        blockTime: t.blockTime,
        firstSeenAt: now,
        lastCheckedAt: now,
      })),
      skipDuplicates: true,
    });

  const transfers = await db.observedTransfer.findMany({
    where: {
      walletId,
      OR: [
        { blockTime: { gte: oldest } },
        { matchedDealId: { in: deals.map((d) => d.id) } },
      ],
    },
  });

  // 2. Match by amount; ambiguous deals go to the team.
  const forcedFlags = new Map<string, string>();
  const newlyLinked = new Set<string>();
  const matches = matchByAmount(
    deals.map(toMatchDeal),
    transfers.map(toMatchTransfer),
  );
  for (const m of matches.links)
    if (await link(m.transferId, m.dealId)) newlyLinked.add(m.dealId);
  for (const a of matches.ambiguous) {
    const deal = deals.find((d) => d.id === a.dealId)!;
    await flagSystem(
      deal,
      `ambiguous: ${a.count} transfers could belong to this deal`,
    );
  }

  // 3. A pasted TxID, after the amount matches (they take precedence).
  let claimResult: ClaimResult | null = null;
  if (claim) {
    deals = await loadDeals();
    const deal = deals.find((d) => d.id === claim.dealId);
    const row = await db.observedTransfer.findFirst({
      where: { walletId, txHash: claim.txHash },
      orderBy: { logIndex: "asc" },
    });
    if (!deal || !row) claimResult = "NOT_FOUND";
    else {
      const verdict = claimByTxId(
        toMatchDeal(deal),
        toMatchTransfer(row),
        deals.map(toMatchDeal),
      );
      if (!verdict.ok)
        claimResult =
          verdict.reason === "HAS_TRANSFER"
            ? "HAS_TRANSFER"
            : verdict.reason === "TAKEN"
              ? "TAKEN"
              : "NOT_FOUND";
      else if (row.matchedDealId === deal.id || (await link(row.id, deal.id))) {
        claimResult = "LINKED";
        if (row.matchedDealId !== deal.id) {
          newlyLinked.add(deal.id);
          await db.dealEvent.create({
            data: {
              dealId: deal.id,
              type: "TXID_SUBMITTED",
              message: "Customer pasted the TxID of their deposit",
              data: { txHash: row.txHash },
              actorType: "CUSTOMER",
            },
          });
        }
        if (verdict.flagReason) forcedFlags.set(deal.id, verdict.flagReason);
      } else claimResult = "TAKEN";
    }
  }

  // 4. Check each deal against its linked transfer and the chain.
  deals = await loadDeals();
  const linkedRows = await db.observedTransfer.findMany({
    where: { matchedDealId: { in: deals.map((d) => d.id) } },
  });
  const completed: string[] = [];
  for (const deal of deals) {
    if (deal.status === "EXPIRED" && !newlyLinked.has(deal.id)) continue;
    const row = linkedRows.find((t) => t.matchedDealId === deal.id) ?? null;
    let linked: { transfer: PlanTransfer; proof: TransferProof } | null = null;
    if (row) {
      const transfer: IncomingTransfer & PlanTransfer = {
        network: row.network,
        txHash: row.txHash,
        logIndex: row.logIndex,
        fromAddress: row.fromAddress,
        toAddress: row.toAddress,
        tokenContract: row.tokenContract,
        amount: row.amount.toFixed(),
        blockTime: row.blockTime,
        confirmations: row.confirmations,
      };
      const proof =
        deal.status === "EXPIRED"
          ? ({ state: "PENDING" } as const)
          : await provider.getProof(transfer);
      if (proof.state === "IN_BLOCK")
        await db.observedTransfer.update({
          where: { id: row.id },
          data: {
            blockNumber: proof.blockNumber,
            confirmations: proof.confirmations,
            lastCheckedAt: now,
          },
        });
      linked = { transfer, proof };
    }

    const plan = planDeal(
      {
        id: deal.id,
        status: deal.status,
        network: deal.cryptoNetwork!,
        ticker: deal.cryptoTicker!,
        depositAddress: deal.depositAddress!,
        expectedQty: deal.expectedQty!.toFixed(),
        lockExpiresAt: deal.lockExpiresAt!,
        depositSeenAt: deal.depositSeenAt,
        confirmations: deal.confirmations,
        payoutTargetMinutes: deal.organization.payoutTargetMinutes,
      },
      linked,
      wallet.minConfirmations,
      now,
      forcedFlags.get(deal.id) ?? null,
    );

    await db
      .$transaction(async (tx) => {
        let status = deal.status;
        for (const step of plan.steps) {
          await transitionDeal(
            tx,
            { id: deal.id, status },
            step.to,
            { type: "SYSTEM" },
            { message: step.message, data: step.data, set: step.set, now },
          );
          status = step.to;
        }
        if (plan.confirmations !== null)
          await tx.deal.updateMany({
            where: { id: deal.id, status: "DEPOSIT_SEEN" },
            data: { confirmations: plan.confirmations },
          });
        if (plan.note)
          await tx.dealEvent.create({
            data: {
              dealId: deal.id,
              type: "DEPOSIT_UPDATE",
              message: plan.note,
              actorType: "SYSTEM",
            },
          });
      })
      .then(() => {
        if (plan.steps.some((s) => s.to === "DEPOSIT_COMPLETE"))
          completed.push(deal.id);
      })
      .catch(ignoreChanged);
  }

  await db.cryptoWallet.update({
    where: { id: walletId },
    data: { lastCheckedAt: now },
  });
  return { completed, claim: claimResult };
}

// The cron: every wallet with deals to watch.
export async function watchAllWallets(now = new Date()) {
  const wallets = await db.cryptoWallet.findMany({
    where: {
      deals: {
        some: {
          OR: [
            { status: { in: OPEN_CRYPTO } },
            {
              status: "EXPIRED",
              matchedTransfer: null,
              createdAt: { gte: new Date(now.getTime() - LATE_WINDOW_MS) },
            },
          ],
        },
      },
    },
    select: { id: true },
  });
  const completed: string[] = [];
  let failed = 0;
  for (const w of wallets) {
    try {
      completed.push(...(await checkDeposits(w.id, { now })).completed);
    } catch (error) {
      failed++;
      const kind = error instanceof Error ? error.name : typeof error;
      console.error(`[crypto-watch] wallet check failed: ${kind}`);
    }
  }
  return { wallets: wallets.length, failed, completed };
}
