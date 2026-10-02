// Long-text rules for boards. Fixed steps on character counts, not
// measurement: Satori and the browser measure text differently, and the
// PNG must match the preview. A heavy Archivo digit is ~0.59em wide.

// Price pills (232 × 112, ~200px for text): 68px fits 5 characters
// ("12345", "1365.5" → 6 is next step), then smaller steps.
const PRICE_STEPS: [maxChars: number, size: number][] = [
  [5, 68],
  [6, 56],
  [7, 48],
  [8, 42],
  [9, 37],
  [10, 34],
];

export function pricePillFontSize(text: string): number {
  return PRICE_STEPS.find(([max]) => text.length <= max)?.[1] ?? 30;
}

// POF rate pills (200 × 88, ~176px): "3.4%", "12.5%" at 56px; "99.99%" at 46px.
export function percentPillFontSize(text: string): number {
  return text.length <= 5 ? 56 : 46;
}

// POF rows: a short name (≤ 14) and a note pill (≤ 24) fit side by side up
// to about 22 characters together; beyond that the pill goes under the name.
export const POF_INLINE_LIMIT = 22;

export function pofNoteBelow(label: string, note: string | null): boolean {
  return note !== null && label.length + note.length > POF_INLINE_LIMIT;
}

// Crypto price boxes (200 × 86, ~176px for text): 56px fits 6 characters
// ("123456" measured 195px wide in Satori at 56px / 800), then smaller.
const COMPACT_PRICE_STEPS: [maxChars: number, size: number][] = [
  [5, 56],
  [6, 48],
  [7, 42],
  [8, 38],
  [9, 34],
  [10, 30],
];

export function compactPriceFontSize(text: string): number {
  return COMPACT_PRICE_STEPS.find(([max]) => text.length <= max)?.[1] ?? 27;
}

// Crypto rows: ticker, then the name and up to 2 network tags on one line,
// in a 320px column (card 856px − badge 80 − gaps 40 − prices 416).
// Estimates from Satori measurements: a name character ~12.5px (24px /
// 500; a 20-character name measured 239–409px), a tag character ~11px plus
// 22px padding (19px / 700), 10px between items. If the name and both
// tags don't fit, the second tag is dropped; a name still too long is
// cut with an ellipsis by the layout. Preview and PNG run the same rule.
export const CRYPTO_META_WIDTH = 320;

const nameWidth = (name: string) => name.length * 12.5;
const tagWidth = (tag: string) => tag.length * 11 + 22;

export function cryptoNetworksShown(
  name: string,
  networks: string[],
): string[] {
  const tags = networks.slice(0, 2);
  const total =
    nameWidth(name) + tags.reduce((sum, tag) => sum + 10 + tagWidth(tag), 0);
  return total > CRYPTO_META_WIDTH ? tags.slice(0, 1) : tags;
}
