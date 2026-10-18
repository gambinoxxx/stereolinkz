// Address checks for our receiving wallets (Invariant 16). A field that
// takes an address accepts only an address in the network's format, and
// anything that looks like a private key or seed phrase is refused with
// a clear error, never stored or logged.
import { createHash } from "node:crypto";

import { keccak256 } from "@/features/crypto-deposits/keccak";
import type { CryptoNetwork } from "@/generated/prisma/client";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const B58 = BigInt(58);
const B256 = BigInt(256);

function base58Decode(text: string): Uint8Array | null {
  let n = BigInt(0);
  for (const ch of text) {
    const digit = BASE58.indexOf(ch);
    if (digit < 0) return null;
    n = n * B58 + BigInt(digit);
  }
  const bytes: number[] = [];
  while (n > BigInt(0)) {
    bytes.unshift(Number(n % B256));
    n /= B256;
  }
  for (const ch of text) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

function base58Encode(bytes: Uint8Array): string {
  let n = BigInt(0);
  for (const b of bytes) n = n * B256 + BigInt(b);
  let out = "";
  while (n > BigInt(0)) {
    out = BASE58[Number(n % B58)] + out;
    n /= B58;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest();

// A Tron address from its hex form, as chain logs give it: 20 bytes
// ("a614…13c"), a 32-byte topic word, or 21 bytes with the 0x41 prefix.
export function tronAddressFromHex(hex: string): string | null {
  const clean = hex.replace(/^0x/, "").toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean)) return null;
  const body =
    clean.length === 42 && clean.startsWith("41")
      ? clean.slice(2)
      : clean.length === 64 && /^0{24}/.test(clean)
        ? clean.slice(24)
        : clean.length === 40
          ? clean
          : null;
  if (!body) return null;
  const payload = Buffer.from(`41${body}`, "hex");
  const check = sha256(sha256(payload)).subarray(0, 4);
  return base58Encode(Buffer.concat([payload, check]));
}

// Tron: base58check of 0x41 + 20 bytes, so 34 characters starting "T".
export function isTronAddress(value: string): boolean {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) return false;
  const bytes = base58Decode(value);
  if (!bytes || bytes.length !== 25 || bytes[0] !== 0x41) return false;
  const body = bytes.subarray(0, 21);
  const check = sha256(sha256(body)).subarray(0, 4);
  return check.every((b, i) => b === bytes[21 + i]);
}

// Bitcoin legacy (1…, P2PKH) and script (3…, P2SH) addresses: base58check
// of a version byte (0x00 / 0x05) and a 20-byte hash.
function isBtcBase58(value: string): boolean {
  if (!/^[13][1-9A-HJ-NP-Za-km-z]{24,33}$/.test(value)) return false;
  const bytes = base58Decode(value);
  if (!bytes || bytes.length !== 25) return false;
  if (bytes[0] !== 0x00 && bytes[0] !== 0x05) return false;
  const check = sha256(sha256(bytes.subarray(0, 21))).subarray(0, 4);
  return check.every((b, i) => b === bytes[21 + i]);
}

// Bitcoin SegWit addresses (BIP-173 bech32 for v0 bc1q…, BIP-350 bech32m
// for v1 taproot bc1p…).
const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i]!;
  }
  return chk >>> 0;
}
function isBtcSegwit(raw: string): boolean {
  if (raw !== raw.toLowerCase() && raw !== raw.toUpperCase()) return false;
  const value = raw.toLowerCase();
  if (!value.startsWith("bc1") || value.length < 14 || value.length > 90)
    return false;
  const data: number[] = [];
  for (const ch of value.slice(3)) {
    const d = BECH32.indexOf(ch);
    if (d < 0) return false;
    data.push(d);
  }
  const hrp = [...("bc" as string)].map((c) => c.charCodeAt(0));
  const expanded = [...hrp.map((c) => c >> 5), 0, ...hrp.map((c) => c & 31)];
  const check = polymod([...expanded, ...data]);
  const version = data[0];
  if (version === undefined || version > 16) return false;
  const expected = version === 0 ? 1 : 0x2bc830a3;
  if (check !== expected) return false;
  // 5-bit groups → bytes (program), no padding allowed.
  let acc = 0;
  let bits = 0;
  const program: number[] = [];
  for (const v of data.slice(1, -6)) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      program.push((acc >> bits) & 0xff);
    }
  }
  if (bits >= 5 || (acc & ((1 << bits) - 1)) !== 0) return false;
  if (version === 0) return program.length === 20 || program.length === 32;
  return version === 1 && program.length === 32; // taproot only
}

export function isBtcAddress(value: string): boolean {
  return isBtcBase58(value) || isBtcSegwit(value);
}

// Ethereum: 0x + 40 hex. Mixed case must match the EIP-55 checksum
// (all-lower or all-upper carries no checksum and is accepted).
export function isEthAddress(value: string): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return false;
  const body = value.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  const hash = Buffer.from(
    keccak256(new TextEncoder().encode(body.toLowerCase())),
  ).toString("hex");
  return [...body].every((ch, i) => {
    if (/[0-9]/.test(ch)) return true;
    const upper = parseInt(hash[i]!, 16) >= 8;
    return upper ? ch === ch.toUpperCase() : ch === ch.toLowerCase();
  });
}

export const SECRET_ERROR =
  "That looks like a private key or recovery phrase. Never enter one here: we only need the receiving address.";

// Private keys (64 hex, WIF, extended keys) and recovery phrases (12+
// words). Deliberately broad: a false alarm costs a retype.
export function looksLikeSecret(raw: string): boolean {
  const value = raw.trim();
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(value)) return true;
  if (/^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(value)) return true;
  if (/^[xyzt]prv[1-9A-HJ-NP-Za-km-z]{100,}$/.test(value)) return true;
  const words = value
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (words.length >= 12 && words.every((w) => /^[a-z]{3,8}$/.test(w)))
    return true;
  return false;
}

export type AddressCheck =
  { ok: true; address: string } | { ok: false; error: string };

export function checkWalletAddress(
  network: CryptoNetwork,
  raw: string,
): AddressCheck {
  const value = raw.trim();
  if (looksLikeSecret(value)) return { ok: false, error: SECRET_ERROR };
  switch (network) {
    case "TRC20":
      return isTronAddress(value)
        ? { ok: true, address: value }
        : {
            ok: false,
            error:
              "Enter a Tron address: 34 characters starting with T. Copy it from your wallet’s Receive screen.",
          };
    case "BTC":
      return isBtcAddress(value)
        ? { ok: true, address: value }
        : {
            ok: false,
            error:
              "Enter a Bitcoin address starting with bc1, 1 or 3. Copy it from your wallet’s Receive screen.",
          };
    case "ETH":
      return isEthAddress(value)
        ? { ok: true, address: value }
        : {
            ok: false,
            error:
              "Enter an Ethereum address: 0x and 40 letters and digits. Check it wasn’t mistyped.",
          };
    case "BEP20":
      // No BEP20 tokens are enabled yet (tokens.ts).
      return { ok: false, error: "BEP20 wallets aren’t available yet." };
  }
}
