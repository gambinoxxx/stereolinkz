"use client";

import Image from "next/image";
import { useState } from "react";

import {
  badgeTextColor,
  coinLetter,
  defaultBadgeColor,
} from "@/features/coins/badge-color";
import { cn } from "@/lib/utils";

type CoinBadgeProps = {
  ticker: string;
  name: string;
  iconUrl?: string | null;
  badgeColor?: string | null;
  size?: 28 | 34 | 44;
  className?: string;
};

const TEXT_SIZE = { 28: "text-[12px]", 34: "text-[14px]", 44: "text-[17px]" };

// The coin's icon, or the first letter of its name on its badge colour
// (also shown if the icon fails to load), as on the boards. Decorative:
// the ticker is always printed next to it.
export function CoinBadge({
  ticker,
  name,
  iconUrl,
  badgeColor,
  size = 34,
  className,
}: CoinBadgeProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const box = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
    className,
  );

  if (iconUrl && iconUrl !== failedUrl)
    return (
      <span
        aria-hidden="true"
        className={cn(box, "bg-bg-surface ring-1 ring-border-default")}
        style={{ width: size, height: size }}
      >
        <Image
          src={iconUrl}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="size-full object-cover"
          onError={() => setFailedUrl(iconUrl)}
        />
      </span>
    );

  const background = badgeColor ?? defaultBadgeColor(ticker);
  return (
    <span
      aria-hidden="true"
      className={cn(box, "font-extrabold", TEXT_SIZE[size])}
      style={{
        width: size,
        height: size,
        background,
        color: badgeTextColor(background),
      }}
    >
      {coinLetter(name, ticker)}
    </span>
  );
}
