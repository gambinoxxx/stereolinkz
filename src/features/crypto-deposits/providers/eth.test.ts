import { describe, expect, it, vi } from "vitest";

import { etherscan } from "@/features/crypto-deposits/providers/eth";

import fx from "./fixtures/eth-transfer.json";

const OURS = fx.tx.result.to; // the recorded transfer's recipient
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function routed(overrides: Partial<Record<string, unknown>> = {}) {
  return vi.fn().mockImplementation(async (url: string) => {
    const action = new URL(url).searchParams.get("action")!;
    if (action in overrides) return json(overrides[action]);
    if (action === "eth_getTransactionByHash") return json(fx.tx);
    if (action === "eth_getTransactionReceipt") return json(fx.receipt);
    if (action === "eth_blockNumber") return json(fx.tip);
    if (action === "balance")
      return json({
        status: "1",
        message: "OK",
        result: "40891626854930000000000",
      });
    return json({}, 404);
  });
}
const client = (fetchImpl: typeof fetch, apiKey = "k") =>
  etherscan({ apiKey, http: { fetchImpl, sleep: async () => {} } });

describe("etherscan.checkTransfer", () => {
  it("reads amount, success and confirmations of a transfer to us", async () => {
    const fetchImpl = routed();
    const got = await client(fetchImpl).checkTransfer(
      fx.tx.result.hash,
      OURS!.toUpperCase().replace("0X", "0x"),
    );
    expect(got).toEqual({
      state: "FOUND",
      valueEth: "0.000094507472790137",
      status: "SUCCESS",
      confirmations:
        Number(BigInt(fx.tip.result) - BigInt(fx.receipt.result.blockNumber)) +
        1,
      finalAfter: 64,
      explorerTx: `https://etherscan.io/tx/${fx.tx.result.hash}`,
    });
    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.searchParams.get("chainid")).toBe("1");
    expect(url.searchParams.get("apikey")).toBe("k");
  });

  it("says when the transfer went elsewhere, wasn't plain ETH or doesn't exist", async () => {
    await expect(
      client(routed()).checkTransfer(
        fx.tx.result.hash,
        "0x0000000000000000000000000000000000000001",
      ),
    ).resolves.toEqual({ state: "NOT_OURS" });
    await expect(
      client(
        routed({
          eth_getTransactionByHash: {
            result: { ...fx.tx.result, input: "0xa9059cbb" },
          },
        }),
      ).checkTransfer(fx.tx.result.hash, OURS!),
    ).resolves.toEqual({ state: "NOT_ETH" });
    await expect(
      client(
        routed({
          eth_getTransactionByHash: { jsonrpc: "2.0", id: 1, result: null },
        }),
      ).checkTransfer(fx.tx.result.hash, OURS!),
    ).resolves.toEqual({ state: "NOT_FOUND" });
  });

  it("is pending before a block, failed when the receipt says so", async () => {
    await expect(
      client(
        routed({
          eth_getTransactionByHash: {
            result: { ...fx.tx.result, blockNumber: null },
          },
        }),
      ).checkTransfer(fx.tx.result.hash, OURS!),
    ).resolves.toMatchObject({ status: "PENDING", confirmations: 0 });
    await expect(
      client(
        routed({
          eth_getTransactionReceipt: {
            result: { ...fx.receipt.result, status: "0x0" },
          },
        }),
      ).checkTransfer(fx.tx.result.hash, OURS!),
    ).resolves.toMatchObject({ status: "FAILED" });
  });

  it("surfaces Etherscan's own errors and a missing key", async () => {
    await expect(
      client(
        routed({
          eth_getTransactionByHash: {
            status: "0",
            message: "NOTOK",
            result: "Invalid API Key",
          },
        }),
      ).checkTransfer(fx.tx.result.hash, OURS!),
    ).rejects.toThrow("Invalid API Key");
    await expect(
      etherscan({ apiKey: "" }).checkTransfer("0x1", OURS!),
    ).rejects.toThrow("ETHERSCAN_API_KEY");
  });

  it("reads a balance in ETH", async () => {
    await expect(client(routed()).balance(OURS!)).resolves.toBe(
      "40891.62685493",
    );
  });
});
