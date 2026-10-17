// Address checks for our receiving wallets (Invariant 16). A field that
// takes an address accepts only an address in the network's format, and
// anything that looks like a private key or seed phrase is refused with
// a clear error, never stored or logged.
import { createHash } from "node:crypto";

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
    case "BEP20":
      // No BEP20 tokens are enabled yet (tokens.ts); the checksum check
      // arrives with them.
      return { ok: false, error: "BEP20 wallets aren’t available yet." };
  }
}
