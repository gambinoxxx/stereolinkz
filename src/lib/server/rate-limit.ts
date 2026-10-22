import "server-only";

// A small in-memory sliding-window limit per key (an IP hash). Per server
// instance, so a soft limit: enough to stop one visitor hammering a public
// route, not a guarantee across instances.
export function createLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) return false;
    hits.set(key, [...recent, now]);
    if (hits.size > 5000) hits.delete(hits.keys().next().value!);
    return true;
  };
}
