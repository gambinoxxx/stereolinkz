// The real providers, called once each. Opt-in only (normal tests never
// call real APIs): LIVE_PROVIDERS=1 npx vitest run src/features/crypto-deposits/providers/live.test.ts
import { describe, expect, it } from "vitest";

import { clearPriceCache, usdPrice } from "@/features/crypto-deposits/prices";
import { btcProvider } from "@/features/crypto-deposits/providers/btc";
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
});
