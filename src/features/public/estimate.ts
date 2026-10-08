// The calculator's estimate: amount × rate in whole naira, worked on
// decimal strings (never floats: Invariant 10). Null for input that isn't
// a plain non-negative number, so the page shows a dash instead of NaN.
import { isDecimalString, multiplyDecimalStrings } from "@/lib/decimal";

export function estimateNaira(amount: string, rate: string): string | null {
  const cleaned = amount.trim().replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned) || !isDecimalString(rate)) return null;
  if (rate.startsWith("-")) return null;
  const product = multiplyDecimalStrings(cleaned, rate);
  const [int = "0", frac = ""] = product.split(".");
  // Round half up on the first decimal digit.
  const rounded =
    frac !== "" && frac.charCodeAt(0) >= "5".charCodeAt(0)
      ? (BigInt(int) + BigInt(1)).toString()
      : BigInt(int).toString();
  return rounded;
}
