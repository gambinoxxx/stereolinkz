// Letter badges for coins without an icon. Pure; shared by the admin
// CoinBadge and the board templates.
import { contrastRatio } from "@/features/settings/contrast";

// A fixed palette of colours, not coins (Invariant 1): a new coin gets one
// by a hash of its ticker, so the same ticker always gets the same colour.
export const BADGE_PALETTE = [
  "#1A9E77",
  "#2775CA",
  "#F7931A",
  "#627EEA",
  "#0F9D9A",
  "#E0A100",
  "#B8327A",
  "#6B2C91",
  "#3E5BC9",
  "#C2410C",
] as const;

const LIGHT_TEXT = "#FFFFFF";
const DARK_TEXT = "#1F0B3F";

export function defaultBadgeColor(ticker: string): string {
  let hash = 0;
  for (const char of ticker.toUpperCase())
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return BADGE_PALETTE[hash % BADGE_PALETTE.length]!;
}

// White or the dark board text, whichever reads better on the badge.
export function badgeTextColor(badgeColor: string): string {
  return contrastRatio(badgeColor, LIGHT_TEXT) >=
    contrastRatio(badgeColor, DARK_TEXT)
    ? LIGHT_TEXT
    : DARK_TEXT;
}

// The first letter of the name, as the design's badges ("Tether" → T).
export function coinLetter(name: string, ticker: string): string {
  return (name.trim()[0] ?? ticker[0] ?? "?").toUpperCase();
}
