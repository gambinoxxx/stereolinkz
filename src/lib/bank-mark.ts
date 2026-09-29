// Bank monogram colour. The schema has no bank colour, so the colour is
// derived from the bank slug over a fixed palette of six tokens
// (--bank-mark-1…6 in globals.css): the same bank always gets the same colour.
export const BANK_MARK_COLORS = 6;

// 0-based palette index for a slug (FNV-1a hash, stable across runtimes).
export function bankMarkIndex(slug: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % BANK_MARK_COLORS;
}

// The monogram letter: the first letter or digit of the name.
export function bankMonogram(name: string): string {
  return (name.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();
}
