import "server-only";

// What the sell-crypto form reads (Invariant 14): the latest Crypto board
// snapshot for rates (naira per $1, the BUY side: we buy the coin), the
// coins we can watch (an official token in tokens.ts with an active
// wallet), and the org's crypto limits. Never the rate tables, and never a
// wallet address: that appears only on a deal's own page.
import { cache } from "react";

import type { CryptoNetwork } from "@/generated/prisma/client";
import { readSnapshot } from "@/features/boards/history";
import { usdPrice } from "@/features/crypto-deposits/prices";
import { DEALABLE_TOKENS, NETWORKS } from "@/features/crypto-deposits/tokens";
import { db } from "@/lib/server/db";

export type CryptoCoinOption = {
  ticker: string;
  name: string;
  iconUrl: string | null;
  badgeColor: string | null;
  rate: string; // naira per $1 (board BUY)
  networks: { network: CryptoNetwork; label: string; chain: string }[];
  // MARKET (BTC): quoted in dollars at the live price, with the margin.
  pricing: "STABLE" | "MARKET";
  priceUsd: string | null; // dollars per coin now (MARKET only)
  decimals: number;
};

export type CryptoDesk = {
  boardId: string;
  timeLabel: string;
  dateLabel: string;
  coins: CryptoCoinOption[];
  minQty: string;
  maxUsd: string;
  lockMinutes: number;
  payoutMinutes: number;
  marginPct: string;
  minFeeUsd: string;
  ethCheck: boolean; // an ETH wallet is set up: link to /deal/check-eth
};

export const getCryptoDesk = cache(
  async (organizationId: string): Promise<CryptoDesk | null> => {
    const [org, board, wallets] = await Promise.all([
      db.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: {
          cryptoMinQty: true,
          cryptoMaxUsd: true,
          rateLockMinutes: true,
          payoutTargetMinutes: true,
          cryptoMarginPct: true,
          cryptoMinFeeUsd: true,
        },
      }),
      db.rateBoard.findFirst({
        where: { organizationId, type: "CRYPTO" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, snapshot: true, snapshotVersion: true },
      }),
      db.cryptoWallet.findMany({
        where: { organizationId, active: true },
        select: { ticker: true, network: true },
      }),
    ]);
    if (!board) return null;
    const snapshot = readSnapshot(board.snapshotVersion, board.snapshot);
    if (snapshot?.type !== "CRYPTO") return null;

    const coins: CryptoCoinOption[] = [];
    for (const row of snapshot.rows) {
      const networks = DEALABLE_TOKENS.filter(
        (t) =>
          t.ticker === row.ticker &&
          wallets.some((w) => w.ticker === t.ticker && w.network === t.network),
      ).map((t) => ({
        network: t.network,
        label: NETWORKS[t.network].label,
        chain: NETWORKS[t.network].chain,
      }));
      if (networks.length === 0) continue;
      const token = DEALABLE_TOKENS.find((t) => t.ticker === row.ticker)!;
      // No live price, no online quote for a market-priced coin.
      const priceUsd =
        token.pricing === "MARKET" ? await usdPrice(row.ticker) : null;
      if (token.pricing === "MARKET" && !priceUsd) continue;
      coins.push({
        ticker: row.ticker,
        name: row.name,
        iconUrl: row.iconUrl,
        badgeColor: row.badgeColor,
        rate: row.buy,
        networks,
        pricing: token.pricing,
        priceUsd,
        decimals: token.decimals,
      });
    }
    return {
      boardId: board.id,
      timeLabel: snapshot.content.timeLabel,
      dateLabel: snapshot.content.dateLabel,
      coins,
      minQty: org.cryptoMinQty.toFixed(),
      maxUsd: org.cryptoMaxUsd.toFixed(),
      lockMinutes: org.rateLockMinutes,
      payoutMinutes: org.payoutTargetMinutes,
      marginPct: org.cryptoMarginPct.toFixed(),
      minFeeUsd: org.cryptoMinFeeUsd.toFixed(),
      ethCheck: wallets.some((w) => w.network === "ETH"),
    };
  },
);
