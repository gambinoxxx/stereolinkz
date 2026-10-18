// Live wallet balances for the admin (Phase 13b), read-only. Each reader
// returns exact decimal strings and never throws: a provider that is down
// shows as "unavailable" for that wallet only.
import { unitsToDecimal } from "@/features/crypto-deposits/amounts";
import { etherscan } from "@/features/crypto-deposits/providers/eth";
import {
  fetchJson,
  type HttpOptions,
} from "@/features/crypto-deposits/providers/http";
import type { CryptoNetwork } from "@/generated/prisma/client";

export type Balance =
  | { ok: true; lines: { label: string; amount: string }[] }
  | { ok: false; error: string };

const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

type TronAccount = {
  data?: { balance?: number; trc20?: Record<string, string>[] }[];
};
type EsploraAddress = {
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
  mempool_stats: { funded_txo_sum: number; spent_txo_sum: number };
};

export async function walletBalance(
  network: CryptoNetwork,
  address: string,
  {
    http,
    tronUrl = "https://api.trongrid.io",
    btcUrl = process.env.BTC_API_URL?.trim() || "https://blockstream.info/api",
  }: { http?: HttpOptions; tronUrl?: string; btcUrl?: string } = {},
): Promise<Balance> {
  try {
    switch (network) {
      case "TRC20": {
        const headers: Record<string, string> = { accept: "application/json" };
        const key = process.env.TRONGRID_API_KEY?.trim();
        if (key) headers["TRON-PRO-API-KEY"] = key;
        const body = await fetchJson<TronAccount>(
          `${tronUrl}/v1/accounts/${address}`,
          { headers },
          http,
        );
        const account = body.data?.[0];
        if (!account)
          return {
            ok: true,
            lines: [
              { label: "USDT", amount: "0" },
              { label: "TRX", amount: "0" },
            ],
          };
        const usdt =
          account.trc20?.find((t) => USDT_TRC20 in t)?.[USDT_TRC20] ?? "0";
        return {
          ok: true,
          lines: [
            { label: "USDT", amount: unitsToDecimal(usdt, 6) },
            // TRX pays the network's energy fees when we send USDT out.
            {
              label: "TRX",
              amount: unitsToDecimal(String(account.balance ?? 0), 6),
            },
          ],
        };
      }
      case "BTC": {
        const a = await fetchJson<EsploraAddress>(
          `${btcUrl}/address/${address}`,
          { headers: { accept: "application/json" } },
          http,
        );
        const confirmed =
          a.chain_stats.funded_txo_sum - a.chain_stats.spent_txo_sum;
        const pending =
          a.mempool_stats.funded_txo_sum - a.mempool_stats.spent_txo_sum;
        return {
          ok: true,
          lines: [
            {
              label: "BTC",
              amount: unitsToDecimal(String(Math.max(0, confirmed)), 8),
            },
            ...(pending > 0
              ? [
                  {
                    label: "BTC unconfirmed",
                    amount: unitsToDecimal(String(pending), 8),
                  },
                ]
              : []),
          ],
        };
      }
      case "ETH": {
        const e = etherscan({ http });
        if (!e.configured)
          return {
            ok: false,
            error: "Add ETHERSCAN_API_KEY to see the ETH balance.",
          };
        return {
          ok: true,
          lines: [{ label: "ETH", amount: await e.balance(address) }],
        };
      }
      case "BEP20":
        return { ok: false, error: "Not available yet." };
    }
  } catch {
    return {
      ok: false,
      error: "Couldn’t reach the network data service. Try again shortly.",
    };
  }
}
