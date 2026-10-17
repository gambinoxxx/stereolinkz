// The official token contracts the app accepts deposits in: a vetted,
// constant list keyed by network + ticker. This is the security exception
// to "no hard-coded crypto data" (Invariant 1): an admin never types a
// contract, so a look-alike token can't be added by mistake or by a
// compromised account. Every entry was checked against the issuer's own
// site and on-chain before it was added (progress-tracker → Decisions).
//
// BEP20 is supported by the schema but has no entries: the BNB Chain
// stablecoins are Binance-issued pegs that Tether and Circle don't list,
// so the owner chose to wait (2026-10-17).
import type { CryptoNetwork } from "@/generated/prisma/client";

export type OfficialToken = {
  network: CryptoNetwork;
  ticker: string;
  contract: string;
  decimals: number;
};

export const OFFICIAL_TOKENS: readonly OfficialToken[] = [
  // Tether, tether.to → Supported Protocols; decimals() = 6 on-chain.
  {
    network: "TRC20",
    ticker: "USDT",
    contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    decimals: 6,
  },
];

export function officialToken(
  network: CryptoNetwork,
  ticker: string,
): OfficialToken | null {
  return (
    OFFICIAL_TOKENS.find((t) => t.network === network && t.ticker === ticker) ??
    null
  );
}

// Networks with at least one official token, in display order.
export function supportedNetworks(): CryptoNetwork[] {
  return [...new Set(OFFICIAL_TOKENS.map((t) => t.network))];
}

export function isOfficialContract(
  network: CryptoNetwork,
  ticker: string,
  contract: string,
): boolean {
  const token = officialToken(network, ticker);
  if (!token) return false;
  // Tron base58 is case-sensitive; EVM hex is compared case-insensitively.
  return network === "TRC20"
    ? contract === token.contract
    : contract.toLowerCase() === token.contract.toLowerCase();
}

export const NETWORKS: Record<
  CryptoNetwork,
  {
    label: string; // "TRC20 (Tron)"
    chain: string; // "Tron"
    defaultConfirmations: number; // practical finality (research, 2026-10-17)
    explorerTx: (txHash: string) => string;
    explorerAddress: (address: string) => string;
  }
> = {
  TRC20: {
    label: "TRC20 (Tron)",
    chain: "Tron",
    defaultConfirmations: 19,
    explorerTx: (h) => `https://tronscan.org/#/transaction/${h}`,
    explorerAddress: (a) => `https://tronscan.org/#/address/${a}`,
  },
  BEP20: {
    label: "BEP20 (BNB Chain)",
    chain: "BNB Chain",
    defaultConfirmations: 15,
    explorerTx: (h) => `https://bscscan.com/tx/${h}`,
    explorerAddress: (a) => `https://bscscan.com/address/${a}`,
  },
};
