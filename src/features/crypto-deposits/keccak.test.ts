import { describe, expect, it } from "vitest";

import { keccak256 } from "@/features/crypto-deposits/keccak";

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const utf8 = (s: string) => new TextEncoder().encode(s);

describe("keccak256", () => {
  it("matches the published test vectors", () => {
    expect(hex(keccak256(utf8("")))).toBe(
      "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    );
    expect(hex(keccak256(utf8("abc")))).toBe(
      "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
    );
  });

  it("handles input longer than one block", () => {
    // Transfer(address,address,uint256), the ERC-20 event topic.
    expect(hex(keccak256(utf8("Transfer(address,address,uint256)")))).toBe(
      "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    );
    expect(keccak256(new Uint8Array(300).fill(0x61))).toHaveLength(32);
  });
});
