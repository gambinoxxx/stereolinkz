import { ArrowDown, ArrowUp } from "lucide-react";

import { compareDecimalStrings, subtractDecimalStrings } from "@/lib/decimal";
import { formatPoints, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";

type RateDeltaProps = {
  current: string;
  previous?: string | null; // null when this is the first rate
  kind: "amount" | "points"; // forex naira amount, or POF percentage points
  className?: string;
};

// Change against the previous rate: ↑4 / ↓0.1 pts / No change. The arrow
// is always shown, so colour is never the only signal.
export function RateDelta({
  current,
  previous,
  kind,
  className,
}: RateDeltaProps) {
  if (previous == null) return null;

  const direction = compareDecimalStrings(current, previous);
  const base =
    "inline-flex items-center gap-px text-[12.5px] font-semibold whitespace-nowrap tabular-nums";

  if (direction === 0) {
    return (
      <span className={cn(base, "text-text-muted", className)}>No change</span>
    );
  }

  const amount = subtractDecimalStrings(current, previous).replace(/^-/, "");
  const text = kind === "amount" ? formatRate(amount) : formatPoints(amount);
  const Icon = direction > 0 ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        base,
        direction > 0 ? "text-state-success" : "text-state-error",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-[13px]" strokeWidth={1.9} />
      <span className="sr-only">{direction > 0 ? "Up " : "Down "}</span>
      {text}
    </span>
  );
}
