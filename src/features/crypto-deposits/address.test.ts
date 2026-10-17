import { describe, expect, it } from "vitest";

import {
  checkWalletAddress,
  isTronAddress,
  looksLikeSecret,
  SECRET_ERROR,
  tronAddressFromHex,
} from "@/features/crypto-deposits/address";

// Real, public Tron addresses (the USDT contract and its deployer).
const TRON_A = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRON_B = "THPvaUhoh2Qn2y9THCZML3H815hhFhn5YC";

describe("isTronAddress", () => {
  it("accepts real addresses", () => {
    expect(isTronAddress(TRON_A)).toBe(true);
    expect(isTronAddress(TRON_B)).toBe(true);
  });

  it("refuses a typo through the checksum", () => {
    expect(isTronAddress(TRON_A.slice(0, -1) + "u")).toBe(false);
    expect(isTronAddress(TRON_A.replace("qje", "jqe"))).toBe(false);
  });

  it("refuses other formats", () => {
    expect(isTronAddress("")).toBe(false);
    expect(isTronAddress(TRON_A.slice(1))).toBe(false);
    expect(isTronAddress("0x55d398326f99059fF775485246999027B3197955")).toBe(
      false,
    );
    expect(isTronAddress(`${TRON_A}1`)).toBe(false);
  });
});

describe("looksLikeSecret", () => {
  it("catches private keys and recovery phrases", () => {
    const hex = "a".repeat(64);
    expect(looksLikeSecret(hex)).toBe(true);
    expect(looksLikeSecret(`0x${hex}`)).toBe(true);
    expect(
      looksLikeSecret("5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ"),
    ).toBe(true);
    expect(
      looksLikeSecret(
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      ),
    ).toBe(true);
    expect(looksLikeSecret(`xprv${"9".repeat(107)}`)).toBe(true);
  });

  it("lets addresses through", () => {
    expect(looksLikeSecret(TRON_A)).toBe(false);
    expect(looksLikeSecret("0x55d398326f99059fF775485246999027B3197955")).toBe(
      false,
    );
  });
});

describe("checkWalletAddress", () => {
  it("trims and accepts a Tron address", () => {
    expect(checkWalletAddress("TRC20", `  ${TRON_A} `)).toEqual({
      ok: true,
      address: TRON_A,
    });
  });

  it("refuses a key with the key error, before the format error", () => {
    expect(checkWalletAddress("TRC20", "b".repeat(64))).toEqual({
      ok: false,
      error: SECRET_ERROR,
    });
  });

  it("refuses BEP20 until its tokens are enabled", () => {
    expect(
      checkWalletAddress("BEP20", "0x55d398326f99059fF775485246999027B3197955")
        .ok,
    ).toBe(false);
  });
});

describe("tronAddressFromHex", () => {
  it("reads the forms chain logs use", () => {
    // The USDT contract, as a log address and with the 0x41 prefix.
    expect(tronAddressFromHex("a614f803b6fd780986a42c78ec9c7f77e6ded13c")).toBe(
      TRON_A,
    );
    expect(
      tronAddressFromHex("41a614f803b6fd780986a42c78ec9c7f77e6ded13c"),
    ).toBe(TRON_A);
    // A topic word: the recipient in the recorded fixture.
    expect(
      tronAddressFromHex(
        "000000000000000000000000517591d35d313bf6a5e33098284502b045e2bc08",
      ),
    ).toBe(TRON_B);
    expect(tronAddressFromHex("zz")).toBeNull();
  });
});
