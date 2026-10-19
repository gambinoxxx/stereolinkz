import type { Metadata } from "next";

import { ReferralSettings } from "@/features/referrals/components/admin/ReferralSettings";
import { isoDayIn } from "@/features/referrals/labels";
import { defaultWindow } from "@/features/referrals/rules";
import type { ReferralSettingsForm } from "@/features/referrals/schema";
import { getProgramme, listStaffCodes } from "@/features/referrals/queries";
import { requireMember } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getUserDisplayName } from "@/lib/server/users";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Referral settings · RateBoard" };

// Settings → Referrals (Phase 13c): the programme and staff codes. Anyone
// on the team can look; only the owner can change (the actions check).
export default async function ReferralSettingsPage() {
  const { organizationId, role } = await requireMember();
  const [programme, codes, memberships] = await Promise.all([
    getProgramme(organizationId),
    listStaffCodes(organizationId),
    db.membership.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, clerkUserId: true, whatsapp: true },
    }),
  ]);
  const members = await Promise.all(
    memberships.map(async (m) => ({
      id: m.id,
      name: await getUserDisplayName(m.clerkUserId),
      whatsapp: m.whatsapp,
    })),
  );
  // A programme that has never run starts with today plus two months.
  const window = defaultWindow(new Date());
  const day = (d: Date) => isoDayIn(d, programme.timeZone);
  return (
    <ReferralSettings
      isOwner={role === "OWNER"}
      programme={programme}
      initial={{
        enabled: programme.enabled,
        startsOn: programme.startsOn ?? day(window.startsAt),
        endsOn: programme.endsOn ?? day(window.endsAt),
        rewardPct: programme.rewardPct,
        holdDays: programme.holdDays,
        newCustomersOnly: programme.newCustomersOnly,
        monthlyCap: programme.monthlyCap?.replace(/\.0+$/, "") ?? "",
        services: programme.services as ReferralSettingsForm["services"],
      }}
      codes={codes}
      members={members}
      siteOrigin={siteUrl().origin}
    />
  );
}
