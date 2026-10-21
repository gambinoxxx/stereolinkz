import type { Metadata } from "next";

import { ReferralSettings } from "@/features/referrals/components/admin/ReferralSettings";
import { isoDayIn } from "@/features/referrals/labels";
import {
  getReferralSettings,
  listStaffCodes,
} from "@/features/referrals/queries";
import { defaultWindow } from "@/features/referrals/rules";
import { requireMember } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getUserDisplayName } from "@/lib/server/users";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Referral settings · RateBoard" };

// Settings → Referrals: campaigns, the rules for all of them, staff codes
// and team numbers. Everyone on the team can look; only the owner can
// change (each action checks).
export default async function ReferralSettingsPage() {
  const { organizationId, role } = await requireMember();
  const [settings, codes, memberships] = await Promise.all([
    getReferralSettings(organizationId),
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
  // A new campaign starts today and runs two months.
  const window = defaultWindow(new Date());
  return (
    <ReferralSettings
      isOwner={role === "OWNER"}
      campaigns={settings.campaigns}
      rules={{
        holdDays: settings.holdDays,
        monthlyCap: settings.monthlyCap?.replace(/\.0+$/, "") ?? "",
      }}
      codes={codes}
      members={members}
      siteOrigin={siteUrl().origin}
      defaults={{
        startsOn: isoDayIn(window.startsAt, settings.timeZone),
        endsOn: isoDayIn(window.endsAt, settings.timeZone),
      }}
    />
  );
}
