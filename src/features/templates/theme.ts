// Board tokens (ui-context.md → Board Tokens). Templates take colours from
// here because Satori can't use CSS variables or Tailwind. The org's brand
// colours (copied into each snapshot) override the defaults:
//   primaryColor    → buy and rate pills, the note dot, the band's 3/4
//   accentColor     → sell pills, note pills, logo bars, contact dot, band's 1/4
//   backgroundColor → Purple Signal's gradient (middle stop; top and bottom
//                     derived with shade()); Daylight stays light
import type { BoardSnapshot } from "@/features/boards/snapshot";

export type ThemeName = "purple-signal" | "daylight";

export type BoardTheme = {
  background: string;
  text: string; // headline and default text
  wordmark: string;
  subheading: string;
  date: string;
  dateStrong: string;
  eqBar: string;
  eqBarAlt: string;
  eqOpacity: number;
  card: string;
  cardBorder: string | null;
  cardShadow: string;
  cardText: string;
  cardMuted: string;
  cardDivider: string;
  flagRing: string;
  primary: string;
  primaryText: string;
  accent: string;
  accentText: string;
  reach: string;
  contactBg: string;
  contactBorder: string;
  contactLabel: string;
  contactText: string;
  fine: string;
};

// The design's Purple Signal gradient stops (stereolinkz-rate-boards.html).
const PURPLE_STOPS = ["#3B1675", "#2A0F58", "#1C0A3D"] as const;

const BASE: Record<ThemeName, BoardTheme> = {
  "purple-signal": {
    background: gradient(165, PURPLE_STOPS, [0, 45, 100]),
    text: "#FFFFFF",
    wordmark: "#FFFFFF",
    subheading: "#D4C8EE",
    date: "#C4B6E3",
    dateStrong: "#FFFFFF",
    eqBar: "#6A35D9",
    eqBarAlt: "#A77CFF",
    eqOpacity: 0.18,
    card: "#F7F4FC",
    cardBorder: null,
    cardShadow: "0 30px 60px rgba(0,0,0,0.28)",
    cardText: "#1F0B3F",
    cardMuted: "#6E6187",
    cardDivider: "#E6DFF2",
    flagRing: "0 0 0 5px #FFFFFF, 0 8px 18px rgba(31,11,63,0.18)",
    primary: "#6A35D9",
    primaryText: "#FFFFFF",
    accent: "#E9B949",
    accentText: "#1F0B3F",
    reach: "#E8E0F7",
    contactBg: "rgba(255,255,255,0.08)",
    contactBorder: "rgba(255,255,255,0.14)",
    contactLabel: "#C4B6E3",
    contactText: "#FFFFFF",
    fine: "#A294C4",
  },
  daylight: {
    background: gradient(170, ["#FFFFFF", "#F3EEFB", "#E9E1F7"], [0, 60, 100]),
    text: "#3B1675",
    wordmark: "#2A0F58",
    subheading: "#6E6187",
    date: "#6E6187",
    dateStrong: "#1F0B3F",
    eqBar: "#6A35D9",
    eqBarAlt: "#A77CFF",
    eqOpacity: 0.12,
    card: "#FFFFFF",
    cardBorder: "#ECE5F7",
    cardShadow: "0 24px 60px rgba(59,22,117,0.14)",
    cardText: "#1F0B3F",
    cardMuted: "#6E6187",
    cardDivider: "#E6DFF2",
    flagRing: "0 0 0 5px #FFFFFF, 0 8px 18px rgba(31,11,63,0.18)",
    primary: "#6A35D9",
    primaryText: "#FFFFFF",
    accent: "#E9B949",
    accentText: "#1F0B3F",
    reach: "#4A3D66",
    contactBg: "#2A0F58",
    contactBorder: "#2A0F58",
    contactLabel: "#D4C8EE",
    contactText: "#FFFFFF",
    fine: "#7D7196",
  },
};

// Bank monogram colours, the same six as the admin's --bank-mark-1…6 in
// globals.css (a test keeps the two lists equal).
export const BANK_MARK_HEX = [
  "#6B2C91",
  "#3E5BC9",
  "#0B7A75",
  "#C77700",
  "#B3261E",
  "#B8327A",
] as const;

function gradient(
  angle: number,
  stops: readonly string[],
  at: readonly number[],
): string {
  return `linear-gradient(${angle}deg, ${stops.map((c, i) => `${c} ${at[i]}%`).join(", ")})`;
}

const HEX = /^#?([0-9a-f]{6})$/i;

// Scales a colour's brightness: factor > 1 lightens, < 1 darkens, keeping
// the hue ("#2A0F58" × 1.4 → "#3B1579"). Invalid input comes back as-is.
export function shade(hex: string, factor: number): string {
  const match = HEX.exec(hex.trim());
  if (!match) return hex;
  const value = match[1]!;
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return (
    "#" +
    channels
      .map((c) =>
        Math.max(0, Math.min(255, Math.round(c * factor)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}

const isHex = (value: string | null): value is string =>
  value !== null && HEX.test(value.trim());

// Purple Signal's gradient for a brand background. The design's own colour
// keeps the design's exact stops; any other colour gets top and bottom
// stops derived from it (×1.4 and ×0.67, the design's own ratios).
export function purpleGradient(background: string | null): string {
  if (!isHex(background)) return BASE["purple-signal"].background;
  const mid = background.trim().toUpperCase().replace(/^#?/, "#");
  if (mid === PURPLE_STOPS[1]) return BASE["purple-signal"].background;
  return gradient(165, [shade(mid, 1.4), mid, shade(mid, 0.67)], [0, 45, 100]);
}

export function boardTheme(
  name: ThemeName,
  brand: BoardSnapshot["content"]["brand"],
): BoardTheme {
  const base = BASE[name];
  const primary = isHex(brand.primaryColor) ? brand.primaryColor : base.primary;
  const accent = isHex(brand.accentColor) ? brand.accentColor : base.accent;
  return {
    ...base,
    primary,
    accent,
    eqBar: primary,
    background:
      name === "purple-signal"
        ? purpleGradient(brand.backgroundColor)
        : base.background,
  };
}
