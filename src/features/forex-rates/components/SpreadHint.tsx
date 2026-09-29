import { isDecimal, normaliseDecimal } from "@/features/forex-rates/schema";
import { compareDecimalStrings, subtractDecimalStrings } from "@/lib/decimal";
import { formatRate } from "@/lib/format";

// Live "Spread ₦13" under the rate inputs; red when sell is below buy.
// Nothing while either field isn't a number yet.
export function SpreadHint({ buy, sell }: { buy: string; sell: string }) {
  const b = normaliseDecimal(buy ?? "");
  const s = normaliseDecimal(sell ?? "");
  if (!isDecimal(b) || !isDecimal(s)) return null;

  if (compareDecimalStrings(s, b) < 0) {
    return (
      <p className="text-[13px] font-medium text-state-error">
        Sell is below buy.
      </p>
    );
  }
  return (
    <p className="text-[13px] text-text-muted">
      Spread ₦{formatRate(subtractDecimalStrings(s, b))}
    </p>
  );
}
