"use client";

import Image from "next/image";
import { useState } from "react";

import { bankMarkIndex, bankMonogram } from "@/lib/bank-mark";
import { cn } from "@/lib/utils";

type BankMarkProps = {
  name: string;
  slug: string; // picks the monogram colour
  logoUrl?: string | null;
  size?: 28 | 34 | 44;
  className?: string;
};

// Static class names so Tailwind generates them (index from bankMarkIndex).
const COLORS = [
  "bg-bank-mark-1",
  "bg-bank-mark-2",
  "bg-bank-mark-3",
  "bg-bank-mark-4",
  "bg-bank-mark-5",
  "bg-bank-mark-6",
];
const TEXT_SIZE = { 28: "text-[12px]", 34: "text-[14px]", 44: "text-[17px]" };

// Bank logo, or a letter monogram in a colour derived from the slug (also
// shown if the logo fails to load).
// Decorative: the bank name is always printed next to it.
export function BankMark({
  name,
  slug,
  logoUrl,
  size = 34,
  className,
}: BankMarkProps) {
  // A logo that fails to load falls back to the monogram. Remembering the
  // failed URL (not a flag) lets a new logo try again.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const box = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
    className,
  );

  if (logoUrl && logoUrl !== failedUrl) {
    return (
      <span
        className={cn(box, "bg-bg-surface ring-1 ring-border-default")}
        style={{ width: size, height: size }}
      >
        <Image
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          unoptimized
          onError={() => setFailedUrl(logoUrl)}
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        box,
        "font-bold text-primary-foreground",
        COLORS[bankMarkIndex(slug)],
        TEXT_SIZE[size],
      )}
      style={{ width: size, height: size }}
    >
      {bankMonogram(name)}
    </span>
  );
}
