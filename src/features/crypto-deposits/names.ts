// "Name on the account" against the customer's name. We have no bank API
// to look an account name up, so the customer types it and this is a soft
// check (a warning on the form, a badge for the team), never a block.
import type { NameCheck } from "@/features/deals/schema";

const words = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length >= 2);

// MATCH: the same names in any order, allowing an extra middle name on
// either side ("Okeke Chinedu John" for "Chinedu Okeke"). CLOSE: at least
// one name in common. DIFFERENT: none.
export function nameCheck(
  customerName: string,
  accountName: string,
): NameCheck {
  const a = new Set(words(customerName));
  const b = new Set(words(accountName));
  if (a.size === 0 || b.size === 0) return "DIFFERENT";
  const shared = [...a].filter((w) => b.has(w)).length;
  if (shared === 0) return "DIFFERENT";
  const smaller = Math.min(a.size, b.size);
  if (shared === smaller && (smaller >= 2 || a.size === b.size)) return "MATCH";
  return "CLOSE";
}
