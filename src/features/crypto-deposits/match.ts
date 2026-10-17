// Matching transfers to deals (pure). A transfer belongs to at most one
// deal. Without a pasted TxID, a deal matches a transfer of EXACTLY its
// expected amount (unique per wallet: amounts.ts → uniqueAmount) that
// arrived after the deal was created. More than one candidate is never
// guessed at: the deal is flagged "ambiguous" for the team.
import type { CryptoNetwork, DealStatus } from "@/generated/prisma/client";
import { sameAmount } from "@/features/crypto-deposits/amounts";
import { isOfficialContract } from "@/features/crypto-deposits/tokens";
import { compareDecimalStrings } from "@/lib/decimal";

export type MatchDeal = {
  id: string;
  status: DealStatus;
  network: CryptoNetwork;
  ticker: string;
  depositAddress: string;
  expectedQty: string;
  createdAt: Date;
  hasTransfer: boolean;
};

export type MatchTransfer = {
  id: string;
  network: CryptoNetwork;
  toAddress: string;
  tokenContract: string;
  amount: string;
  blockTime: Date;
  matchedDealId: string | null;
};

export type AmountMatches = {
  links: { dealId: string; transferId: string }[];
  ambiguous: { dealId: string; count: number }[];
};

// Deals still waiting for a transfer: open, or expired without one (a
// late deposit is still linked so the team can re-quote it).
const WAITING: readonly DealStatus[] = ["AWAITING_DEPOSIT", "EXPIRED"];

function fits(deal: MatchDeal, t: MatchTransfer): boolean {
  return (
    t.matchedDealId === null &&
    t.network === deal.network &&
    t.toAddress === deal.depositAddress &&
    isOfficialContract(deal.network, deal.ticker, t.tokenContract) &&
    sameAmount(t.amount, deal.expectedQty) &&
    t.blockTime.getTime() >= deal.createdAt.getTime()
  );
}

export function matchByAmount(
  deals: readonly MatchDeal[],
  transfers: readonly MatchTransfer[],
): AmountMatches {
  const waiting = deals.filter(
    (d) => !d.hasTransfer && WAITING.includes(d.status),
  );
  const candidates = new Map(
    waiting.map((d) => [d.id, transfers.filter((t) => fits(d, t))]),
  );
  // How many waiting deals each transfer could belong to.
  const claims = new Map<string, number>();
  for (const list of candidates.values())
    for (const t of list) claims.set(t.id, (claims.get(t.id) ?? 0) + 1);

  const out: AmountMatches = { links: [], ambiguous: [] };
  for (const deal of waiting) {
    const list = candidates.get(deal.id) ?? [];
    if (list.length === 0) continue;
    const only = list[0]!;
    if (list.length > 1 || (claims.get(only.id) ?? 0) > 1)
      out.ambiguous.push({ dealId: deal.id, count: list.length });
    else out.links.push({ dealId: deal.id, transferId: only.id });
  }
  return out;
}

export type TxIdClaim =
  | { ok: true; flagReason: string | null }
  | { ok: false; reason: "TAKEN" | "NOT_OURS" | "HAS_TRANSFER" };

// The customer pasted a TxID and we found that transfer at our address.
// Anyone can read our address's transfers on a block explorer, so a TxID
// alone proves nothing about who sent it: a transfer that fits another
// waiting deal's exact amount stays theirs, and a pasted TxID whose
// amount differs from the deal's is linked but flagged for the team
// (never completed on the paste alone).
export function claimByTxId(
  deal: MatchDeal,
  transfer: MatchTransfer,
  others: readonly MatchDeal[],
): TxIdClaim {
  if (deal.hasTransfer) return { ok: false, reason: "HAS_TRANSFER" };
  if (transfer.matchedDealId !== null && transfer.matchedDealId !== deal.id)
    return { ok: false, reason: "TAKEN" };
  if (transfer.toAddress !== deal.depositAddress)
    return { ok: false, reason: "NOT_OURS" };
  const theirs = others.some(
    (o) =>
      o.id !== deal.id &&
      !o.hasTransfer &&
      WAITING.includes(o.status) &&
      fits(o, { ...transfer, matchedDealId: null }),
  );
  if (theirs) return { ok: false, reason: "TAKEN" };

  if (transfer.blockTime.getTime() < deal.createdAt.getTime())
    return {
      ok: true,
      flagReason: "pasted TxID: the transfer is older than this deal",
    };
  const cmp = compareDecimalStrings(transfer.amount, deal.expectedQty);
  if (cmp > 0)
    return {
      ok: true,
      flagReason: `pasted TxID: received ${transfer.amount}, more than the ${deal.expectedQty} ${deal.ticker} expected. Check the sender before paying`,
    };
  // Less than expected, a wrong token or network: the deposit check flags
  // it with its own reason.
  return { ok: true, flagReason: null };
}
