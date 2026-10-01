// WCAG 2 contrast for the brand colour warning. Pure.

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

// "#RRGGBB" → relative luminance (0 black … 1 white).
export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

// 1 (no contrast) … 21 (black on white).
export function contrastRatio(hexA: string, hexB: string): number {
  const [hi, lo] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export const MIN_CONTRAST = 4.5;

// The warning under a swatch, or null when the text is readable. A
// warning, not an error: brand colours are the owner's call.
export function contrastWarning(colour: string, text: string): string | null {
  const ratio = contrastRatio(colour, text);
  return ratio >= MIN_CONTRAST
    ? null
    : `Hard to read: contrast is ${(Math.floor(ratio * 10) / 10).toFixed(1)}:1. Aim for 4.5:1 or more.`;
}
