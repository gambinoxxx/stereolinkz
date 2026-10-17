// Coin amounts as exact decimal strings (Invariant 10): raw token units
// from a chain become "200.5" with the token's decimals, and the deposit
// page's "Send exactly 500.37" comes from whole cents, never floats.
import {
  compareDecimalStrings,
  subtractDecimalStrings,
  toDecimalString,
} from "@/lib/decimal";

// "200500000" with 6 decimals → "200.5".
export function unitsToDecimal(raw: string, decimals: number): string {
  if (!/^\d+$/.test(raw)) throw new Error("Not a token amount");
  const digits = raw.replace(/^0+/, "").padStart(decimals + 1, "0");
  const int = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

// "0x…0bebc200" (a 32-byte log word) → raw units as a decimal string.
export function hexWordToUnits(hex: string): string {
  const clean = hex.replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{1,64}$/.test(clean)) throw new Error("Not a hex word");
  return BigInt(`0x${clean}`).toString();
}

export const addDecimalStrings = (a: string, b: string) =>
  subtractDecimalStrings(a, `-${toDecimalString(b).replace(/^-/, "")}`);

// Whole cents of a non-negative amount with at most 2 decimals.
function toCents(amount: string): bigint {
  const [int = "0", frac = ""] = toDecimalString(amount).split(".");
  if (frac.length > 2) throw new Error("More than 2 decimals");
  return BigInt(int) * BigInt(100) + BigInt(frac.padEnd(2, "0") || "0");
}

function fromCents(cents: bigint): string {
  const int = cents / BigInt(100);
  const frac = (cents % BigInt(100)).toString().padStart(2, "0");
  return `${int}.${frac}`;
}

// "Send exactly …": the amount the customer typed, or, when another open
// deal on the same wallet already expects that amount, the same amount
// plus a few cents that no open deal uses (500 → 500.37), so a transfer
// can be matched to one deal by its amount alone. Returns null if all 99
// suffixes are taken (the caller refuses the deal: "try again shortly").
export function uniqueAmount(
  base: string,
  taken: readonly string[],
  random: () => number = Math.random,
): string | null {
  const used = new Set(taken.map((t) => normalize(t)));
  const start = toCents(base);
  if (!used.has(fromCents(start))) return fromCents(start);
  const offsets = Array.from({ length: 99 }, (_, i) => i + 1);
  // Shuffle so the suffix isn't guessable from the order deals arrive in.
  for (let i = offsets.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [offsets[i], offsets[j]] = [offsets[j]!, offsets[i]!];
  }
  for (const k of offsets) {
    const candidate = fromCents(start + BigInt(k));
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

// "500.370000000000000000" (a Decimal(38,18) column) → "500.37".
function normalize(amount: string): string {
  const [int = "0", frac = ""] = toDecimalString(amount).split(".");
  const trimmed = frac.replace(/0+$/, "");
  if (trimmed.length > 2) return `${BigInt(int)}.${trimmed}`; // never equal to a cents amount
  return `${BigInt(int)}.${trimmed.padEnd(2, "0")}`;
}

export function sameAmount(a: string, b: string): boolean {
  return compareDecimalStrings(a, b) === 0;
}

// naira ÷ rate, rounded DOWN to whole cents (the linked "You receive" box
// on the form): never promise more coins' worth than the naira typed.
export function coinsForNaira(naira: string, rate: string): string | null {
  const n = toDecimalString(naira);
  const r = toDecimalString(rate);
  if (compareDecimalStrings(r, "0") <= 0) return null;
  const scale = (s: string) => s.split(".")[1]?.length ?? 0;
  const k = Math.max(scale(n), scale(r));
  const big = (s: string) =>
    BigInt(s.replace(".", "") + "0".repeat(k - scale(s)));
  const cents = (big(n) * BigInt(100)) / big(r);
  return fromCents(cents);
}
