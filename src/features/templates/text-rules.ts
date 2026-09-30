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
