import { describe, expect, it, vi } from "vitest";

import { walletBalance } from "@/features/crypto-deposits/providers/balances";

import btc from "./fixtures/btc-address.json";
import tron from "./fixtures/tron-account.json";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const http = (body: unknown, status = 200) => ({
  fetchImpl: vi.fn().mockResolvedValue(json(body, status)),
  sleep: async () => {},
});

describe("walletBalance", () => {
  it("reads USDT and TRX on Tron", async () => {
    await expect(
      walletBalance("TRC20", "THPvaUhoh2Qn2y9THCZML3H815hhFhn5YC", {
        http: http(tron),
      }),
    ).resolves.toEqual({
      ok: true,
      lines: [
        { label: "USDT", amount: "24847.874401" },
        { label: "TRX", amount: "1128842.884286" },
      ],
    });
  });

  it("reads confirmed and unconfirmed BTC", async () => {
    const got = await walletBalance("BTC", btc.address, { http: http(btc) });
    expect(got).toEqual({
      ok: true,
      lines: [
        { label: "BTC", amount: "1.12554112" },
        { label: "BTC unconfirmed", amount: "0.1499742" },
      ],
    });
  });

  it("shows unavailable instead of throwing", async () => {
    await expect(
      walletBalance("BTC", btc.address, { http: http({}, 503) }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      walletBalance("ETH", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"),
    ).resolves.toMatchObject({ ok: false });
  });
});
