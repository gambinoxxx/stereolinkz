// Deal references: "SLZ-1047". The number comes from
// Organization.dealRefCounter, incremented in the same transaction as the
// insert (createDeal), so two parallel submits never share one.

export function formatRef(prefix: string, n: number): string {
  return `${prefix}-${n}`;
}

// "slz-1047" → "SLZ-1047"; null for anything that isn't a reference.
export function normalizeRef(value: string): string | null {
  const ref = value.trim().toUpperCase();
  return /^[A-Z]{2,6}-\d{1,9}$/.test(ref) ? ref : null;
}

export const REF_PREFIX_PATTERN = /^[A-Z]{2,6}$/;
