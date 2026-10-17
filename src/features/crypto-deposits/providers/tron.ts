// TRC20 transfers through TronGrid (research 2026-10-17):
//   index:   GET /v1/accounts/{address}/transactions/trc20
//            ?only_to=true&min_timestamp=…&order_by=block_timestamp,asc
//            &limit=200, paged with meta.fingerprint
//   receipt: POST /wallet/gettransactioninfobyid (block, result, logs)
//   head:    POST /wallet/getnowblock
// The API key goes in the TRON-PRO-API-KEY header (TRONGRID_API_KEY).
import {
  hexWordToUnits,
  unitsToDecimal,
} from "@/features/crypto-deposits/amounts";
import { tronAddressFromHex } from "@/features/crypto-deposits/address";
import {
  fetchJson,
  type HttpOptions,
} from "@/features/crypto-deposits/providers/http";
import {
  ProviderError,
  type DepositProvider,
  type IncomingTransfer,
  type TransferProof,
} from "@/features/crypto-deposits/providers/types";
import { compareDecimalStrings } from "@/lib/decimal";

const TRANSFER_TOPIC =
  "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const MAX_PAGES = 10; // 2,000 transfers per check is far beyond our volume

type ListResponse = {
  success?: boolean;
  data?: {
    transaction_id: string;
    token_info?: { address?: string; decimals?: number };
    block_timestamp: number;
    from: string;
    to: string;
    type?: string;
    value: string;
  }[];
  meta?: { fingerprint?: string | null };
};

type TxInfo = {
  id?: string;
  blockNumber?: number;
  receipt?: { result?: string };
  log?: { address: string; topics: string[]; data: string }[];
};

type NowBlock = { block_header?: { raw_data?: { number?: number } } };

export function tronProvider({
  baseUrl = "https://api.trongrid.io",
  apiKey = process.env.TRONGRID_API_KEY,
  decimalsFor,
  http,
}: {
  baseUrl?: string;
  apiKey?: string;
  // Decimals by contract, from tokens.ts. A transfer of any other token
  // keeps the index's decimals, only so it can be shown to the team.
  decimalsFor: (contract: string) => number | null;
  http?: HttpOptions;
}): DepositProvider {
  const headers: Record<string, string> = { accept: "application/json" };
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;

  return {
    network: "TRC20",

    async listIncomingTransfers(address, since) {
      const out: IncomingTransfer[] = [];
      let fingerprint: string | null | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const params = new URLSearchParams({
          only_to: "true",
          min_timestamp: String(since.getTime()),
          order_by: "block_timestamp,asc",
          limit: "200",
        });
        if (fingerprint) params.set("fingerprint", fingerprint);
        const body = await fetchJson<ListResponse>(
          `${baseUrl}/v1/accounts/${address}/transactions/trc20?${params}`,
          { headers },
          http,
        );
        if (body.success === false || !Array.isArray(body.data))
          throw new ProviderError("TronGrid list failed", true);
        for (const row of body.data) {
          if (row.to !== address || (row.type && row.type !== "Transfer"))
            continue;
          const contract = row.token_info?.address ?? "";
          const decimals = decimalsFor(contract) ?? row.token_info?.decimals;
          if (!contract || decimals == null || !/^\d+$/.test(row.value))
            continue;
          const logIndex = out.filter(
            (t) => t.txHash === row.transaction_id,
          ).length;
          out.push({
            network: "TRC20",
            txHash: row.transaction_id,
            logIndex,
            fromAddress: row.from,
            toAddress: row.to,
            tokenContract: contract,
            amount: unitsToDecimal(row.value, decimals),
            blockTime: new Date(row.block_timestamp),
          });
        }
        fingerprint = body.meta?.fingerprint;
        if (!fingerprint) break;
      }
      return out;
    },

    async getProof(transfer): Promise<TransferProof> {
      const info = await fetchJson<TxInfo>(
        `${baseUrl}/wallet/gettransactioninfobyid`,
        {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ value: transfer.txHash }),
        },
        http,
      );
      if (!info.id || info.blockNumber == null) return { state: "PENDING" };
      if (info.receipt?.result !== "SUCCESS")
        return { state: "FAILED", reason: "the transaction failed on-chain" };

      // The receipt must hold this exact transfer: the token contract, our
      // address and the amount, as the chain recorded them.
      const decimals = decimalsFor(transfer.tokenContract);
      const found = (info.log ?? []).some((log) => {
        if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC) return false;
        if (tronAddressFromHex(log.address) !== transfer.tokenContract)
          return false;
        if (tronAddressFromHex(log.topics[2] ?? "") !== transfer.toAddress)
          return false;
        if (decimals == null) return false;
        const amount = unitsToDecimal(hexWordToUnits(log.data), decimals);
        return compareDecimalStrings(amount, transfer.amount) === 0;
      });
      if (!found)
        return {
          state: "FAILED",
          reason: "the transaction receipt doesn’t show this transfer",
        };

      const head = await fetchJson<NowBlock>(
        `${baseUrl}/wallet/getnowblock`,
        { method: "POST", headers },
        http,
      );
      const latest = head.block_header?.raw_data?.number;
      if (latest == null) throw new ProviderError("TronGrid head failed", true);
      return {
        state: "IN_BLOCK",
        blockNumber: BigInt(info.blockNumber),
        confirmations: Math.max(0, latest - info.blockNumber + 1),
      };
    },
  };
}
