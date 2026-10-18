import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearPriceCache, usdPrice } from "@/features/crypto-deposits/prices";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("usdPrice", () => {
  beforeEach(() => clearPriceCache());

  it("reads CoinGecko's simple price as a decimal string", async () => {
    // Recorded 2026-10-18: {"bitcoin":{"usd":81355}}
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(json({ bitcoin: { usd: 81355 } }));
    await expect(
      usdPrice("BTC", { http: { fetchImpl, sleep: async () => {} } }),
    ).resolves.toBe("81355");
    expect(String(fetchImpl.mock.calls[0]![0])).toContain("ids=bitcoin");
  });

  it("keeps cents and caches for 30 s", async () => {
    let t = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(json({ bitcoin: { usd: 81355.42 } }));
    const opts = { http: { fetchImpl, sleep: async () => {} }, now: () => t };
    await expect(usdPrice("BTC", opts)).resolves.toBe("81355.42");
    t = 20_000;
    await usdPrice("BTC", opts);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t = 31_000;
    await usdPrice("BTC", opts);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns null instead of guessing", async () => {
    const down = vi.fn().mockResolvedValue(json({}, 503));
    await expect(
      usdPrice("BTC", { http: { fetchImpl: down, sleep: async () => {} } }),
    ).resolves.toBeNull();
    const odd = vi.fn().mockResolvedValue(json({ bitcoin: { usd: -1 } }));
    await expect(
      usdPrice("BTC", { http: { fetchImpl: odd, sleep: async () => {} } }),
    ).resolves.toBeNull();
    await expect(usdPrice("DOGE")).resolves.toBeNull();
  });
});
