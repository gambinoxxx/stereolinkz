// Ethereum, read-only (Phase 13b): the ETH transfer checker and the ETH
// balance, through Etherscan API V2 (free tier covers Ethereum mainnet,
// chainid=1; ETHERSCAN_API_KEY). ETH is never a website deal.
//   proxy eth_getTransactionByHash / eth_getTransactionReceipt / eth_blockNumber
//   account balance
import { unitsToDecimal } from "@/features/crypto-deposits/amounts";
import {
  fetchJson,
  type HttpOptions,
} from "@/features/crypto-deposits/providers/http";
import { ProviderError } from "@/features/crypto-deposits/providers/types";
import { NETWORKS } from "@/features/crypto-deposits/tokens";

export type EthCheck =
  | { state: "NOT_FOUND" }
  | { state: "NOT_ETH" } // a contract or token call, not a plain ETH transfer
  | { state: "NOT_OURS" }
  | {
      state: "FOUND";
      valueEth: string;
      status: "PENDING" | "SUCCESS" | "FAILED";
      confirmations: number;
      finalAfter: number;
      explorerTx: string;
    };

type Rpc<T> = { result?: T | string | null; status?: string; message?: string };
type RpcTx = {
  to: string | null;
  value: string;
  blockNumber: string | null;
  input: string;
};
type RpcReceipt = { status: string; blockNumber: string };

export function etherscan({
  apiKey = process.env.ETHERSCAN_API_KEY?.trim(),
  baseUrl = "https://api.etherscan.io/v2/api",
  http,
}: { apiKey?: string; baseUrl?: string; http?: HttpOptions } = {}) {
  const call = async <T>(params: Record<string, string>): Promise<T | null> => {
    if (!apiKey) throw new ProviderError("ETHERSCAN_API_KEY is not set", false);
    const q = new URLSearchParams({ chainid: "1", ...params, apikey: apiKey });
    const body = await fetchJson<Rpc<T>>(
      `${baseUrl}?${q}`,
      { headers: { accept: "application/json" } },
      http,
    );
    // Etherscan's own errors: {"status":"0","message":"NOTOK","result":"…"}
    if (body.status === "0" && body.message !== "OK")
      throw new ProviderError(
        `Etherscan: ${String(body.result ?? body.message)}`,
        /rate limit/i.test(String(body.result)),
      );
    return (body.result ?? null) as T | null;
  };

  return {
    configured: !!apiKey,

    async checkTransfer(txHash: string, ourAddress: string): Promise<EthCheck> {
      const tx = await call<RpcTx>({
        module: "proxy",
        action: "eth_getTransactionByHash",
        txhash: txHash,
      });
      if (!tx || typeof tx !== "object") return { state: "NOT_FOUND" };
      if (tx.input && tx.input !== "0x") return { state: "NOT_ETH" };
      if (!tx.to || tx.to.toLowerCase() !== ourAddress.toLowerCase())
        return { state: "NOT_OURS" };
      const valueEth = unitsToDecimal(BigInt(tx.value).toString(), 18);
      const finalAfter = NETWORKS.ETH.defaultConfirmations;
      const explorerTx = NETWORKS.ETH.explorerTx(txHash);
      if (!tx.blockNumber)
        return {
          state: "FOUND",
          valueEth,
          status: "PENDING",
          confirmations: 0,
          finalAfter,
          explorerTx,
        };
      const [receipt, tip] = await Promise.all([
        call<RpcReceipt>({
          module: "proxy",
          action: "eth_getTransactionReceipt",
          txhash: txHash,
        }),
        call<string>({ module: "proxy", action: "eth_blockNumber" }),
      ]);
      if (!receipt || typeof receipt !== "object" || typeof tip !== "string")
        throw new ProviderError("Etherscan receipt failed", true);
      const confirmations = Math.max(
        0,
        Number(BigInt(tip) - BigInt(receipt.blockNumber)) + 1,
      );
      return {
        state: "FOUND",
        valueEth,
        status: receipt.status === "0x1" ? "SUCCESS" : "FAILED",
        confirmations,
        finalAfter,
        explorerTx,
      };
    },

    async balance(address: string): Promise<string> {
      const wei = await call<string>({
        module: "account",
        action: "balance",
        address,
        tag: "latest",
      });
      if (typeof wei !== "string" || !/^\d+$/.test(wei))
        throw new ProviderError("Etherscan balance failed", true);
      return unitsToDecimal(wei, 18);
    },
  };
}
