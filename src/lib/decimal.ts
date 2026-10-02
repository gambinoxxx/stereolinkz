// Decimal strings for rates (architecture.md → Invariant 10). Rates cross
// the server/client boundary as plain strings such as "1365.0000"; these
// helpers work on the digits and never go through a JavaScript float.

// Prisma.Decimal (decimal.js) has toFixed(), which never uses exponent
// notation ("1e-7"), unlike its toString().
type DecimalLike = { toFixed(): string };

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

// True for plain decimals such as "1365" or "3.40" (what toDecimalString
// accepts); false for half-typed input such as "13." or "—".
export function isDecimalString(value: string): boolean {
  return DECIMAL_PATTERN.test(value);
}

export function toDecimalString(value: DecimalLike | string): string {
  const text = typeof value === "string" ? value.trim() : value.toFixed();
  if (!DECIMAL_PATTERN.test(text)) {
    throw new Error(`Not a decimal number: "${text}"`);
  }
  return text;
}

type ParsedDecimal = { negative: boolean; int: string; frac: string };

// Splits "-001365.5000" into sign, "1365" and "5" (no leading or trailing
// zeros), so equal values always have equal parts.
function parse(value: string): ParsedDecimal {
  const text = toDecimalString(value);
  const negative = text.startsWith("-");
  const [intRaw = "", fracRaw = ""] = text.replace("-", "").split(".");
  const int = intRaw.replace(/^0+/, "");
  const frac = fracRaw.replace(/0+$/, "");
  // "-0" and "-0.00" are zero, not negative.
  return { negative: negative && (int !== "" || frac !== ""), int, frac };
}

function compareMagnitude(a: ParsedDecimal, b: ParsedDecimal): -1 | 0 | 1 {
  if (a.int.length !== b.int.length) {
    return a.int.length < b.int.length ? -1 : 1;
  }
  if (a.int !== b.int) return a.int < b.int ? -1 : 1;
  const width = Math.max(a.frac.length, b.frac.length);
  const fa = a.frac.padEnd(width, "0");
  const fb = b.frac.padEnd(width, "0");
  if (fa === fb) return 0;
  return fa < fb ? -1 : 1;
}

// Compares by digits: "1365" equals "1365.0000"; "9.9" < "10".
export function compareDecimalStrings(a: string, b: string): -1 | 0 | 1 {
  const pa = parse(a);
  const pb = parse(b);
  if (pa.negative !== pb.negative) return pa.negative ? -1 : 1;
  const magnitude = compareMagnitude(pa, pb);
  return pa.negative ? ((-magnitude || 0) as -1 | 0 | 1) : magnitude;
}

// a − b as a decimal string, exact (scaled BigInt, not floats). Used for
// change arrows: subtractDecimalStrings("1365", "1360.5") → "4.5".
export function subtractDecimalStrings(a: string, b: string): string {
  const pa = parse(a);
  const pb = parse(b);
  const scale = Math.max(pa.frac.length, pb.frac.length);
  const toBig = (p: ParsedDecimal) => {
    const digits = BigInt((p.int || "0") + p.frac.padEnd(scale, "0"));
    return p.negative ? -digits : digits;
  };
  const diff = toBig(pa) - toBig(pb);
  const negative = diff < BigInt(0);
  const digits = (negative ? -diff : diff).toString().padStart(scale + 1, "0");
  const int = digits.slice(0, digits.length - scale);
  const frac = digits.slice(digits.length - scale).replace(/0+$/, "");
  return (negative ? "-" : "") + int + (frac ? `.${frac}` : "");
}

// a × b as a decimal string, exact (scaled BigInt, not floats). Used for
// the crypto drawer's worked example: multiplyDecimalStrings("500",
// "1580") → "790000".
export function multiplyDecimalStrings(a: string, b: string): string {
  const pa = parse(a);
  const pb = parse(b);
  const scale = pa.frac.length + pb.frac.length;
  const product =
    BigInt((pa.int || "0") + pa.frac) * BigInt((pb.int || "0") + pb.frac);
  const negative = pa.negative !== pb.negative && product !== BigInt(0);
  const digits = product.toString().padStart(scale + 1, "0");
  const int = digits.slice(0, digits.length - scale);
  const frac = digits.slice(digits.length - scale).replace(/0+$/, "");
  return (negative ? "-" : "") + int + (frac ? `.${frac}` : "");
}
