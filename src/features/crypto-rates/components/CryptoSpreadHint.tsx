import { isDecimal, normaliseDecimal } from "@/features/forex-rates/schema";
import {
  compareDecimalStrings,
  multiplyDecimalStrings,
  subtractDecimalStrings,
} from "@/lib/decimal";
import { formatRate } from "@/lib/format";

// A fixed example amount for the worked example (crypto-edit.html).
const EXAMPLE_DOLLARS = "500";

// Live "Spread ₦40 per $1. A customer selling $500 receives ₦790,000."
// under the rate inputs (decimal-safe, no floats); red when sell is below
// buy. `fallback` shows while either field isn't a number yet.
export function CryptoSpreadHint({
  buy,
  sell,
  fallback,
}: {
  buy: string;
  sell: string;
  fallback?: string;
}) {
  const b = normaliseDecimal(buy ?? "");
  const s = normaliseDecimal(sell ?? "");
  if (!isDecimal(b) || !isDecimal(s))
    return fallback ? (
      <p className="text-[13px] text-text-muted">{fallback}</p>
    ) : null;

  if (compareDecimalStrings(s, b) < 0)
    return (
      <p className="text-[13px] font-medium text-state-error">
        Sell is below buy.
      </p>
    );
  return (
    <p className="text-[13px] text-text-muted">
      Spread ₦{formatRate(subtractDecimalStrings(s, b))} per $1. A customer
      selling ${EXAMPLE_DOLLARS} receives ₦
      {formatRate(multiplyDecimalStrings(EXAMPLE_DOLLARS, b))}.
    </p>
  );
}
