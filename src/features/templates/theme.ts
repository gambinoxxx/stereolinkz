// Board tokens (ui-context.md → Board Tokens). Templates read colours from
// here because Satori cannot use CSS variables or Tailwind.
// Organization brand colours in the snapshot override primary/accent.
export const purpleSignal = {
  background: "linear-gradient(165deg, #3B1675 0%, #2A0F58 45%, #1C0A3D 100%)",
  headline: "#FFFFFF",
  subheading: "#D4C8EE",
  date: "#C4B6E3",
  dateStrong: "#FFFFFF",
  eqBar: "#6A35D9",
  eqBarAlt: "#A77CFF",
  card: "#F7F4FC",
  cardText: "#1F0B3F",
  cardMuted: "#6E6187",
  cardDivider: "#E6DFF2",
  cardShadow: "0 30px 60px rgba(0,0,0,.28)",
  flagRing: "0 0 0 5px #FFFFFF, 0 8px 18px rgba(31,11,63,.18)",
  primary: "#6A35D9", // buy pill, POF rate pill, note dot
  primaryText: "#FFFFFF",
  accent: "#E9B949", // sell pill, notes, logo bars
  accentText: "#1F0B3F",
  reach: "#E8E0F7",
  contactBg: "rgba(255,255,255,.08)",
  contactBorder: "rgba(255,255,255,.14)",
  contactLabel: "#C4B6E3",
  fine: "#A294C4",
} as const;

export type BoardTheme = typeof purpleSignal;
