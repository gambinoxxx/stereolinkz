// The deposit check (Invariant 16): a transfer completes a deal only when
// all six checks pass. Anything else is FLAGGED for the team, or EXPIRED
// when it arrived after the rate lock (the team re-quotes). Never confirm
// on a guess. Pure: the watcher passes in what it read from the chain.
import type { CryptoNetwork } from "@/generated/prisma/client";
import { isOfficialContract } from "@/features/crypto-deposits/tokens";
import { compareDecimalStrings, subtractDecimalStrings } from "@/lib/decimal";

export type CheckDeal = {
  network: CryptoNetwork;
  ticker: string;
  depositAddress: string;
  expectedQty: string;
  lockExpiresAt: Date;
};

export type CheckTransfer = {
  network: CryptoNetwork;
  toAddress: string;
  tokenContract: string;
  amount: string;
  blockTime: Date;
  confirmations: number;
};

export const CHECK_KEYS = [
  "destination",
  "contract",
  "network",
  "amount",
  "confirmations",
  "lock",
] as const;
export type CheckKey = (typeof CHECK_KEYS)[number];

export type Verdict =
  | { outcome: "COMPLETE"; overpaidBy: string | null }
  | { outcome: "SEEN" } // everything passes but confirmations are still counting
  | { outcome: "FLAGGED"; reason: string }
  | { outcome: "EXPIRED"; reason: string };

export type CheckResult = {
  checks: Record<CheckKey, boolean>;
  verdict: Verdict;
};

export function checkDeposit(
  deal: CheckDeal,
  transfer: CheckTransfer,
  minConfirmations: number,
): CheckResult {
  const checks: Record<CheckKey, boolean> = {
    destination: transfer.toAddress === deal.depositAddress,
    contract: isOfficialContract(
      deal.network,
      deal.ticker,
      transfer.tokenContract,
    ),
    network: transfer.network === deal.network,
    amount: compareDecimalStrings(transfer.amount, deal.expectedQty) >= 0,
    confirmations: transfer.confirmations >= minConfirmations,
    lock: transfer.blockTime.getTime() <= deal.lockExpiresAt.getTime(),
  };

  const verdict = ((): Verdict => {
    if (!checks.network) return { outcome: "FLAGGED", reason: "wrong network" };
    if (!checks.destination)
      return { outcome: "FLAGGED", reason: "not sent to this deal’s address" };
    if (!checks.contract)
      return {
        outcome: "FLAGGED",
        reason: `wrong token: not the official ${deal.ticker} contract`,
      };
    if (!checks.amount)
      return {
        outcome: "FLAGGED",
        reason: `underpaid: received ${transfer.amount} of ${deal.expectedQty} ${deal.ticker}`,
      };
    if (!checks.lock)
      return {
        outcome: "EXPIRED",
        reason: "late deposit: arrived after the rate lock ended",
      };
    if (!checks.confirmations) return { outcome: "SEEN" };
    const over = subtractDecimalStrings(transfer.amount, deal.expectedQty);
    return {
      outcome: "COMPLETE",
      overpaidBy: compareDecimalStrings(over, "0") > 0 ? over : null,
    };
  })();

  return { checks, verdict };
}
