import { describe, expect, it } from "vitest";

import { SECRET_ERROR } from "@/features/crypto-deposits/address";
import { parseWalletInput } from "@/features/crypto-deposits/wallet-input";

const BTC = "bc1qjn7e2xk99m4g4d4j3hszxqfh4uk585jq5m6dt7";
const ETH = "0xd12b07d2165991819a8925b64e2bc99b482696bf";

describe("parseWalletInput (addCryptoWallet)", () => {
  it("accepts BTC and ETH wallets (Phase 13b networks)", () => {
    expect(
      parseWalletInput({
        ticker: "BTC",
        network: "BTC",
        address: BTC,
        minConfirmations: "2",
      }),
    ).toEqual({
      ok: true,
      data: {
        ticker: "BTC",
        network: "BTC",
        address: BTC,
        minConfirmations: 2,
      },
    });
    expect(
      parseWalletInput({
        ticker: "ETH",
        network: "ETH",
        address: ` ${ETH} `,
        minConfirmations: "64",
      }),
    ).toMatchObject({ ok: true, data: { network: "ETH", address: ETH } });
  });

  it("still accepts USDT on TRC20", () => {
    expect(
      parseWalletInput({
        ticker: "USDT",
        network: "TRC20",
        address: "THPvaUhoh2Qn2y9THCZML3H815hhFhn5YC",
        minConfirmations: "19",
      }).ok,
    ).toBe(true);
  });

  it("refuses a private key before checking the format", () => {
    for (const network of ["ETH", "BTC"] as const)
      expect(
        parseWalletInput({
          ticker: network,
          network,
          address:
            "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318",
          minConfirmations: "2",
        }),
      ).toEqual({
        ok: false,
        error: SECRET_ERROR,
        fieldErrors: { address: SECRET_ERROR },
      });
  });

  it("puts a bad network on the Coin and network field", () => {
    const r = parseWalletInput({
      ticker: "BTC",
      network: "SOL",
      address: BTC,
      minConfirmations: "2",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.network).toBe("Pick a network.");
  });

  it("refuses a coin that isn't offered on that network", () => {
    const r = parseWalletInput({
      ticker: "ETH",
      network: "BTC",
      address: BTC,
      minConfirmations: "2",
    });
    expect(r).toMatchObject({
      ok: false,
      fieldErrors: { network: "Not supported." },
    });
  });

  it("refuses an address from another network", () => {
    const r = parseWalletInput({
      ticker: "ETH",
      network: "ETH",
      address: BTC,
      minConfirmations: "64",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.address).toBeDefined();
  });
});
