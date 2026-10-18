// The real providers, called once each. Opt-in only (normal tests never
// call real APIs): LIVE_PROVIDERS=1 npx vitest run src/features/crypto-deposits/providers/live.test.ts
import { describe, expect, it } from "vitest";

import { clearPriceCache, usdPrice } from "@/features/crypto-deposits/prices";
import { walletBalance } from "@/features/crypto-deposits/providers/balances";
import { btcProvider } from "@/features/crypto-deposits/providers/btc";
import { etherscan } from "@/features/crypto-deposits/providers/eth";
import { tronProvider } from "@/features/crypto-deposits/providers/tron";
import { OFFICIAL_TOKENS } from "@/features/crypto-deposits/tokens";

const enabled = process.env.LIVE_PROVIDERS === "1";

describe.skipIf(!enabled)("live providers", { timeout: 60_000 }, () => {
  it("BTC: lists a busy public address's deposits and proves the newest", async () => {
    const address =
      "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97";
    const p = btcProvider();
    const list = await p.listIncomingTransfers(
      address,
      new Date(Date.now() - 365 * 24 * 60 * 60_000),
    );
    expect(list.length).toBeGreaterThan(0);
    const proof = await p.getProof(list[0]!);
    expect(["IN_BLOCK", "PENDING"]).toContain(proof.state);
    console.log("BTC", list.length, "deposits; newest", list[0]!.amount, proof);
  });

  it("TRC20: lists USDT into a public address", async () => {
    const p = tronProvider({
      decimalsFor: (c) =>
        OFFICIAL_TOKENS.find((t) => t.contract === c)?.decimals ?? null,
    });
    const list = await p.listIncomingTransfers(
      "THPvaUhoh2Qn2y9THCZML3H815hhFhn5YC",
      new Date("2023-11-01T00:00:00Z"),
    );
    expect(list.length).toBeGreaterThan(0);
  });

  it("price: reads BTC in dollars", async () => {
    clearPriceCache();
    const price = await usdPrice("BTC");
    expect(price).toMatch(/^\d+(\.\d+)?$/);
    console.log("BTC $", price);
  });

  it("balances: reads USDT and BTC for public addresses", async () => {
    const usdt = await walletBalance(
      "TRC20",
      "THPvaUhoh2Qn2y9THCZML3H815hhFhn5YC",
    );
    expect(usdt.ok && usdt.lines.map((l) => l.label)).toEqual(["USDT", "TRX"]);
    const btc = await walletBalance(
      "BTC",
      "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97",
    );
    expect(btc.ok && btc.lines[0]!.label).toBe("BTC");
    console.log("balances", JSON.stringify([usdt, btc]));
  });

  // Needs ETHERSCAN_API_KEY. Picks a plain ETH transfer from a recent block,
  // so there's no fixed hash to go stale.
  it.skipIf(!process.env.ETHERSCAN_API_KEY?.trim())(
    "ETH: checks a recent transfer's confirmations and reads a balance",
    async () => {
      const key = process.env.ETHERSCAN_API_KEY!.trim();
      const q = (params: Record<string, string>) =>
        fetch(
          `https://api.etherscan.io/v2/api?${new URLSearchParams({ chainid: "1", ...params, apikey: key })}`,
        ).then((r) => r.json());
      const head = (await q({ module: "proxy", action: "eth_blockNumber" }))
        .result as string;
      const block = (
        await q({
          module: "proxy",
          action: "eth_getBlockByNumber",
          tag: `0x${(BigInt(head) - BigInt(5)).toString(16)}`,
          boolean: "true",
        })
      ).result as {
        transactions: {
          hash: string;
          to: string | null;
          input: string;
          value: string;
        }[];
      };
      const plain = block.transactions.find(
        (t) => t.to && t.input === "0x" && BigInt(t.value) > BigInt(0),
      )!;
      expect(plain).toBeDefined();
      const p = etherscan();
      const found = await p.checkTransfer(plain.hash, plain.to!);
      expect(found.state).toBe("FOUND");
      if (found.state === "FOUND") {
        expect(found.status).toBe("SUCCESS");
        expect(found.confirmations).toBeGreaterThanOrEqual(5);
      }
      const notOurs = await p.checkTransfer(
        plain.hash,
        "0x0000000000000000000000000000000000000001",
      );
      expect(notOurs.state).toBe("NOT_OURS");
      const bal = await walletBalance("ETH", plain.to!);
      expect(bal.ok && bal.lines[0]!.label).toBe("ETH");
      console.log("ETH", found, JSON.stringify(bal));
    },
  );
});
