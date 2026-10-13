import "server-only";

// Customer access to a deal (Invariant 14): only with its tracking token.
// A wrong token, a missing token, another deal's token and a deal that
// doesn't exist all give the same null, so the pages show one "not found".
import { normalizeRef } from "@/features/deals/refs";
import { tokenMatches } from "@/features/deals/security";
import { db } from "@/lib/server/db";

export async function findDealIdByToken(
  organizationId: string,
  rawRef: string,
  token: string | null | undefined,
): Promise<string | null> {
  const ref = normalizeRef(rawRef);
  const deal = ref
    ? await db.deal.findUnique({
        where: { organizationId_ref: { organizationId, ref } },
        select: { id: true, trackingTokenHash: true },
      })
    : null;
  // Compare even when the deal is missing (against a dummy hash), so the
  // response time doesn't tell whether a reference exists.
  const matches = tokenMatches(
    token,
    deal?.trackingTokenHash ?? "0".repeat(64),
  );
  return deal && matches ? deal.id : null;
}
