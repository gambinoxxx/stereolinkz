import { describe, expect, it, vi } from "vitest";

import { tronProvider } from "@/features/crypto-deposits/providers/tron";
import { ProviderError } from "@/features/crypto-deposits/providers/types";
import { OFFICIAL_TOKENS } from "@/features/crypto-deposits/tokens";

import nowBlock from "./fixtures/tron-now-block.json";
import transfers from "./fixtures/tron-transfers.json";
import txInfo from "./fixtures/tron-tx-info.json";

// Recorded from TronGrid (2026-10-17): three transfers into a public
// address, one real USDT and two other tokens.
const ADDRESS = "THPvaUhoh2Qn2y9THCZML3H815hhFhn5YC";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const decimalsFor = (c: string) =>
  OFFICIAL_TOKENS.find((t) => t.contract === c)?.decimals ?? null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function provider(fetchImpl: typeof fetch, apiKey = "k") {
  return tronProvider({
    apiKey,
    decimalsFor,
    http: { fetchImpl, sleep: async () => {} },
  });
}

describe("tronProvider.listIncomingTransfers", () => {
  it("reads every token transfer to the address, with exact amounts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(transfers));
    const got = await provider(fetchImpl).listIncomingTransfers(
      ADDRESS,
      new Date(1700000000000),
    );
    expect(got).toHaveLength(3);
    expect(got[0]).toEqual({
      network: "TRC20",
      txHash:
        "c7bd09262ae713ea3e0da5f270155093fc3bef85654368aab18cd8e897aed505",
      logIndex: 0,
      fromAddress: "TZ4hBM3vSND8KAuJvTFWUrRy58TMxCeuFu",
      toAddress: ADDRESS,
      tokenContract: USDT,
      amount: "200",
      blockTime: new Date(1700085171000),
    });
    // Another token is kept (with its own decimals) for the wrong-token check.
    expect(got[1]).toMatchObject({
      tokenContract: "TY2G6iSCd7tyUfYYdjFZ1oVbsohavB1vSh",
      amount: "1991",
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain(
      `/v1/accounts/${ADDRESS}/transactions/trc20?`,
    );
    expect(String(url)).toContain("only_to=true");
    expect(String(url)).toContain("min_timestamp=1700000000000");
    expect(init.headers["TRON-PRO-API-KEY"]).toBe("k");
  });

  it("follows the fingerprint to the next page", async () => {
    const first = { ...transfers, meta: { fingerprint: "abc" } };
    const second = { ...transfers, data: [], meta: {} };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(first))
      .mockResolvedValueOnce(json(second));
    await provider(fetchImpl).listIncomingTransfers(ADDRESS, new Date(0));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1]![0])).toContain("fingerprint=abc");
  });

  it("retries a rate limit with backoff, then gives up", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json(transfers));
    await expect(
      provider(fetchImpl).listIncomingTransfers(ADDRESS, new Date(0)),
    ).resolves.toHaveLength(3);

    const always = vi.fn().mockImplementation(async () => json({}, 503));
    await expect(
      provider(always).listIncomingTransfers(ADDRESS, new Date(0)),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(always).toHaveBeenCalledTimes(4);
  });

  it("does not retry a refused request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 401));
    await expect(
      provider(fetchImpl).listIncomingTransfers(ADDRESS, new Date(0)),
    ).rejects.toMatchObject({ retryable: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("tronProvider.getProof", () => {
  const transfer = {
    network: "TRC20" as const,
    txHash: txInfo.id,
    logIndex: 0,
    fromAddress: "TZ4hBM3vSND8KAuJvTFWUrRy58TMxCeuFu",
    toAddress: ADDRESS,
    tokenContract: USDT,
    amount: "200",
    blockTime: new Date(1700085171000),
  };

  function chain(info: unknown) {
    return vi
      .fn()
      .mockImplementation(async (url: string) =>
        json(url.endsWith("gettransactioninfobyid") ? info : nowBlock),
      );
  }

  it("counts confirmations from the receipt's block", async () => {
    await expect(provider(chain(txInfo)).getProof(transfer)).resolves.toEqual({
      state: "IN_BLOCK",
      blockNumber: BigInt(56484287),
      confirmations: 20,
    });
  });

  it("is pending until the transaction is in a block", async () => {
    await expect(provider(chain({})).getProof(transfer)).resolves.toEqual({
      state: "PENDING",
    });
  });

  it("fails a reverted transaction", async () => {
    const reverted = { ...txInfo, receipt: { result: "REVERT" } };
    await expect(
      provider(chain(reverted)).getProof(transfer),
    ).resolves.toMatchObject({ state: "FAILED" });
  });

  it("fails when the receipt disagrees with the index", async () => {
    for (const lie of [
      { ...transfer, amount: "2000" },
      { ...transfer, toAddress: USDT },
      { ...transfer, tokenContract: "TY2G6iSCd7tyUfYYdjFZ1oVbsohavB1vSh" },
    ])
      await expect(
        provider(chain(txInfo)).getProof(lie),
      ).resolves.toMatchObject({ state: "FAILED" });
  });
});
