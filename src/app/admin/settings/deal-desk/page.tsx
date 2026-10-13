import type { Metadata } from "next";

import { DealDeskSettings } from "@/features/deals/components/DealDeskSettings";
import { PHASE12_SERVICES } from "@/features/deals/services";
import { requireMember } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getUserDisplayName } from "@/lib/server/users";

export const metadata: Metadata = { title: "Deal desk settings · RateBoard" };

export default async function DealDeskSettingsPage() {
  const { organizationId } = await requireMember();
  const [org, memberships, accounts] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        name: true,
        dealServicesEnabled: true,
        contactSlaMinutes: true,
        dealRefPrefix: true,
        dealAlertEmails: true,
        dealDefaultOwnerId: true,
        rateLockMinutes: true,
        payoutTargetMinutes: true,
      },
    }),
    db.membership.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, clerkUserId: true },
    }),
    db.paymentAccount.findMany({
      where: { organizationId },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        bank: true,
        accountNumber: true,
        accountName: true,
        currency: true,
        services: true,
        active: true,
      },
    }),
  ]);
  const members = await Promise.all(
    memberships.map(async (m) => ({
      id: m.id,
      name: await getUserDisplayName(m.clerkUserId),
    })),
  );
  const phase12 = (s: string): s is (typeof PHASE12_SERVICES)[number] =>
    (PHASE12_SERVICES as readonly string[]).includes(s);

  return (
    <DealDeskSettings
      initial={{
        services: org.dealServicesEnabled.filter(phase12),
        contactSlaMinutes: String(org.contactSlaMinutes),
        dealRefPrefix: org.dealRefPrefix,
        dealAlertEmails: org.dealAlertEmails,
        dealDefaultOwnerId: org.dealDefaultOwnerId,
      }}
      orgName={org.name}
      members={members}
      accounts={accounts.map((a) => ({
        ...a,
        services: a.services.filter(phase12),
      }))}
      crypto={{
        rateLockMinutes: org.rateLockMinutes,
        payoutTargetMinutes: org.payoutTargetMinutes,
      }}
      emailReady={!!process.env.RESEND_API_KEY && !!process.env.DEAL_ALERT_FROM}
    />
  );
}
