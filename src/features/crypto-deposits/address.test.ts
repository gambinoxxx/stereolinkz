import { describe, expect, it } from "vitest";

import {
  checkWalletAddress,
  isBtcAddress,
  isEthAddress,
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

describe("isBtcAddress", () => {
  it("accepts every address type", () => {
    for (const a of [
      "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", // P2PKH (the genesis address)
      "3C8mzzeiyakvXkQadUM5f98zCt5NQWwXo1", // P2SH
      "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", // P2WPKH
      "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97", // P2WSH
      "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0", // taproot (BIP-350)
    ])
      expect(isBtcAddress(a), a).toBe(true);
  });

  it("refuses typos, wrong checksums and other coins", () => {
    for (const a of [
      "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb",
      "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdr",
      "bc1qAr0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", // mixed case
      // v1 with a bech32 (not bech32m) checksum (BIP-350 invalid vector)
      "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd",
      "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", // testnet
      TRON_A,
      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    ])
      expect(isBtcAddress(a), a).toBe(false);
  });
});

describe("isEthAddress", () => {
  it("accepts EIP-55 checksummed and single-case addresses", () => {
    for (const a of [
      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
      "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
      "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
      "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
      "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
    ])
      expect(isEthAddress(a), a).toBe(true);
  });

  it("refuses a broken checksum and other formats", () => {
    for (const a of [
      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD",
      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeA",
      "5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
      TRON_A,
    ])
      expect(isEthAddress(a), a).toBe(false);
  });
});
