import { z } from "zod";

import { ledgerCsv } from "@/features/referrals/csv";
import { getLedger } from "@/features/referrals/queries";
import { getMember } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const query = z.object({
  referrer: z.string().max(80).optional().catch(undefined),
  status: z
    .enum(["PENDING", "READY", "APPROVED", "PAID", "VOID"])
    .optional()
    .catch(undefined),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
});

// The referral ledger as CSV, with the page's filters (Phase 13c). Team
// members only (Invariant 7); the same fields as the ledger, so never the
// customer's details.
export async function GET(request: Request) {
  const member = await getMember();
  if (!member)
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filters = query.parse(params);
  const ledger = await getLedger(member.organizationId, filters);
  const name = `referrals-${filters.month ?? new Date().toISOString().slice(0, 7)}.csv`;
  return new Response(ledgerCsv(ledger.rows, ledger.timeZone), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
