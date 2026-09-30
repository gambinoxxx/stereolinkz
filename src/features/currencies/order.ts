// Board order of currencies. Pure, so the table (optimistic UI) and the
// server (validation) share it, and it's tested on its own.

// Moves the item at `from` so it ends up at index `to`.
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item === undefined) return [...list];
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

// Drop `dragged` before or after `target` (the drop indicator's side).
export function dropOrder(
  ids: readonly string[],
  dragged: string,
  target: string,
  side: "before" | "after",
): string[] {
  if (dragged === target) return [...ids];
  const without = ids.filter((id) => id !== dragged);
  const at = without.indexOf(target);
  if (at === -1 || !ids.includes(dragged)) return [...ids];
  without.splice(side === "before" ? at : at + 1, 0, dragged);
  return without;
}

// A new order is valid only if it names exactly the org's current
// (non-archived) currencies, each once. Anything else means the list the
// admin saw is out of date, or the input was tampered with.
export function isSameIdSet(
  ordered: readonly string[],
  existing: readonly string[],
): boolean {
  if (ordered.length !== existing.length) return false;
  const seen = new Set(ordered);
  if (seen.size !== ordered.length) return false;
  return existing.every((id) => seen.has(id));
}
