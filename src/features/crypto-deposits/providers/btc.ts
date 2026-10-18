// Bitcoin deposits through an Esplora API (research 2026-10-18):
// Blockstream by default, mempool.space as an alternative (BTC_API_URL).
//   GET /address/{a}/txs                 mempool + newest 25 confirmed
//   GET /address/{a}/txs/chain/{txid}    the next 25 confirmed
//   GET /tx/{txid}                       outputs and status
//   GET /blocks/tip/height               the chain tip
// A deposit is one transaction's outputs to our address, summed. Our own
// spends (an input from our address, e.g. change) are never deposits.
import { satsToBtc } from "@/features/crypto-deposits/amounts";
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
import { NATIVE } from "@/features/crypto-deposits/tokens";
import { compareDecimalStrings } from "@/lib/decimal";

type EsploraTx = {
  txid: string;
  vin: { prevout?: { scriptpubkey_address?: string } | null }[];
  vout: { scriptpubkey_address?: string; value: number }[];
  status: { confirmed: boolean; block_height?: number; block_time?: number };
};

const MAX_PAGES = 10;

function toUs(tx: EsploraTx, address: string): bigint | null {
  if (tx.vin.some((i) => i.prevout?.scriptpubkey_address === address))
    return null; // our own spend
  let sats = BigInt(0);
  for (const o of tx.vout)
    if (o.scriptpubkey_address === address && Number.isSafeInteger(o.value))
      sats += BigInt(o.value);
  return sats > BigInt(0) ? sats : null;
}

export function btcProvider({
  baseUrl = process.env.BTC_API_URL?.trim() || "https://blockstream.info/api",
  http,
  now = () => new Date(),
}: {
  baseUrl?: string;
  http?: HttpOptions;
  now?: () => Date;
} = {}): DepositProvider {
  const get = <T>(path: string) =>
    fetchJson<T>(
      `${baseUrl}${path}`,
      { headers: { accept: "application/json" } },
      http,
    );

  return {
    network: "BTC",

    async listIncomingTransfers(address, since) {
      const out: IncomingTransfer[] = [];
      let page = await get<EsploraTx[]>(`/address/${address}/txs`);
      for (let n = 0; n < MAX_PAGES; n++) {
        if (!Array.isArray(page))
          throw new ProviderError("Esplora list failed", true);
        let older = false;
        for (const tx of page) {
          const time =
            tx.status.confirmed && tx.status.block_time
              ? new Date(tx.status.block_time * 1000)
              : now(); // unconfirmed: first seen now
          if (time < since) {
            older = true;
            continue;
          }
          const sats = toUs(tx, address);
          if (sats === null) continue;
          out.push({
            network: "BTC",
            txHash: tx.txid,
            logIndex: 0,
            fromAddress: tx.vin[0]?.prevout?.scriptpubkey_address ?? "",
            toAddress: address,
            tokenContract: NATIVE,
            amount: satsToBtc(sats),
            blockTime: time,
          });
        }
        const confirmed = page.filter((t) => t.status.confirmed);
        const last = confirmed.at(-1);
        if (older || !last || confirmed.length < 25) break;
        page = await get<EsploraTx[]>(
          `/address/${address}/txs/chain/${last.txid}`,
        );
      }
      return out;
    },

    async getProof(transfer): Promise<TransferProof> {
      let tx: EsploraTx;
      try {
        tx = await get<EsploraTx>(`/tx/${transfer.txHash}`);
      } catch (error) {
        if (error instanceof ProviderError && !error.retryable)
          return {
            state: "FAILED",
            reason: "the transaction is no longer found (replaced or dropped)",
          };
        throw error;
      }
      const sats = toUs(tx, transfer.toAddress);
      if (
        sats === null ||
        compareDecimalStrings(satsToBtc(sats), transfer.amount) !== 0
      )
        return {
          state: "FAILED",
          reason: "the transaction doesn’t pay this amount to our address",
        };
      if (!tx.status.confirmed || tx.status.block_height == null)
        return { state: "PENDING" };
      const tip = await get<number>(`/blocks/tip/height`);
      if (!Number.isSafeInteger(tip))
        throw new ProviderError("Esplora tip failed", true);
      return {
        state: "IN_BLOCK",
        blockNumber: BigInt(tx.status.block_height),
        confirmations: Math.max(0, tip - tx.status.block_height + 1),
      };
    },
  };
}
