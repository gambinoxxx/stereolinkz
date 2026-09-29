import Image from "next/image";

import { flagDataUri } from "@/features/templates/assets/flags";
import { cn } from "@/lib/utils";

type CurrencyFlagProps = {
  flagCode: string | null; // Currency.flagCode, e.g. "us"
  currencyCode: string; // shown when there is no bundled flag
  size?: 28 | 34 | 44;
  className?: string;
};

const TEXT_SIZE = { 28: "text-[9.5px]", 34: "text-[11px]", 44: "text-[13px]" };

// Round flag from the bundled SVGs (the same ones the boards use). Without
// a flag, the currency code sits in a round badge instead. Decorative: the
// code is always printed next to it.
export function CurrencyFlag({
  flagCode,
  currencyCode,
  size = 34,
  className,
}: CurrencyFlagProps) {
  const src = flagCode ? flagDataUri(flagCode) : null;
  const box = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-border-default",
    className,
  );

  if (!src) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          box,
          "bg-accent-soft font-bold tracking-tight text-accent-primary",
          TEXT_SIZE[size],
        )}
        style={{ width: size, height: size }}
      >
        {currencyCode}
      </span>
    );
  }

  return (
    <span className={box} style={{ width: size, height: size }}>
      <Image src={src} alt="" width={size} height={size} unoptimized />
    </span>
  );
}
