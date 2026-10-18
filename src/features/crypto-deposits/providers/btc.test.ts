import { describe, expect, it, vi } from "vitest";

import { btcProvider } from "@/features/crypto-deposits/providers/btc";

import fixture from "./fixtures/btc-address-txs.json";
import tip from "./fixtures/btc-tip.json";

// Recorded from blockstream.info (2026-10-18); two made-up txs (see _note).
const ADDRESS =
  "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97";
const NOW = new Date("2026-10-18T10:00:00Z");
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function provider(fetchImpl: typeof fetch) {
  return btcProvider({
    baseUrl: "https://esplora.test/api",
    http: { fetchImpl, sleep: async () => {} },
    now: () => NOW,
  });
}

describe("btcProvider.listIncomingTransfers", () => {
  it("sums each transaction's outputs to us, skipping our own spends", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(fixture.txs));
    const got = await provider(fetchImpl).listIncomingTransfers(
      ADDRESS,
      new Date(0),
    );
    expect(got.map((t) => [t.txHash.slice(0, 8), t.amount])).toEqual([
      ["ffffffff", "0.00491237"], // unconfirmed, first seen now
      ["be35fdf6", "0.00000546"],
      ["9f5d8b64", "0.00001628"],
      ["1c5c8c5a", "0.000115"],
    ]);
    expect(got[0]).toMatchObject({
      network: "BTC",
      tokenContract: "native",
      toAddress: ADDRESS,
      blockTime: NOW,
    });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(
      `https://esplora.test/api/address/${ADDRESS}/txs`,
    );
  });

  it("stops at transfers older than the window", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(fixture.txs));
    const got = await provider(fetchImpl).listIncomingTransfers(
      ADDRESS,
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(got.map((t) => t.txHash.slice(0, 8))).toEqual(["ffffffff"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("btcProvider.getProof", () => {
  const confirmed = fixture.txs.find((t) => t.txid.startsWith("1c5c8c5a"))!;
  const transfer = {
    network: "BTC" as const,
    txHash: confirmed.txid,
    logIndex: 0,
    fromAddress: "",
    toAddress: ADDRESS,
    tokenContract: "native",
    amount: "0.000115",
    blockTime: NOW,
  };
  const chain = (tx: unknown, status = 200) =>
    vi
      .fn()
      .mockImplementation(async (url: string) =>
        url.endsWith("/blocks/tip/height") ? json(tip.tip) : json(tx, status),
      );

  it("counts confirmations from the block height", async () => {
    await expect(
      provider(chain(confirmed)).getProof(transfer),
    ).resolves.toEqual({
      state: "IN_BLOCK",
      blockNumber: BigInt(confirmed.status.block_height!),
      confirmations: tip.tip - confirmed.status.block_height! + 1,
    });
  });

  it("is pending while unconfirmed", async () => {
    const unconfirmed = fixture.txs[0]!;
    await expect(
      provider(chain(unconfirmed)).getProof({
        ...transfer,
        txHash: unconfirmed.txid,
        amount: "0.00491237",
      }),
    ).resolves.toEqual({ state: "PENDING" });
  });

  it("fails a transaction that vanished or pays a different amount", async () => {
    await expect(
      provider(chain({}, 404)).getProof(transfer),
    ).resolves.toMatchObject({ state: "FAILED" });
    await expect(
      provider(chain(confirmed)).getProof({ ...transfer, amount: "0.0002" }),
    ).resolves.toMatchObject({ state: "FAILED" });
  });
});
