import type { Metadata } from "next";
import { z } from "zod";

import { CodesList } from "@/features/referrals/components/admin/CodesList";
import { LedgerView } from "@/features/referrals/components/admin/LedgerView";
import { isoDayIn } from "@/features/referrals/labels";
import { getLedger, listReferralCodes } from "@/features/referrals/queries";
import { requireMember } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Referrals · RateBoard" };

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

// The referral rewards ledger (Phase 13c). Deal ref, service, date, code,
// referrer, our profit and the reward, never the referred customer's
// details; then every code with its owner, deals and rewards. The
// owner approves ready rewards, marks them paid with the bank reference,
// or voids them; everyone on the team can look.
export default async function ReferralsPage({
  searchParams,
}: PageProps<"/admin/referrals">) {
  const { organizationId, role } = await requireMember();
  const filters = query.parse(await searchParams);
  const [ledger, codes] = await Promise.all([
    getLedger(organizationId, filters),
    listReferralCodes(organizationId),
  ]);
  return (
    <>
      <LedgerView
        isOwner={role === "OWNER"}
        filters={filters}
        today={isoDayIn(new Date(), ledger.timeZone)}
        {...ledger}
      />
      <CodesList codes={codes} />
    </>
  );
}
