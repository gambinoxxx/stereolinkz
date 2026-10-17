import type { Metadata } from "next";

import { DealDeskSettings } from "@/features/deals/components/DealDeskSettings";
import { DESK_SERVICES } from "@/features/deals/services";
import { formatBoardDay, formatBoardTime } from "@/lib/format";
import { requireMember } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getUserDisplayName } from "@/lib/server/users";

export const metadata: Metadata = { title: "Deal desk settings · RateBoard" };

export default async function DealDeskSettingsPage() {
  const { organizationId } = await requireMember();
  const [org, memberships, accounts, wallets] = await Promise.all([
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
        cryptoMinQty: true,
        cryptoMaxUsd: true,
        payoutAlertEmails: true,
        timezone: true,
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
    db.cryptoWallet.findMany({
      where: { organizationId, active: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        ticker: true,
        network: true,
        address: true,
        minConfirmations: true,
        active: true,
        lastCheckedAt: true,
        lastFailedAt: true,
      },
    }),
  ]);
  const now = new Date();
  const at = (d: Date) =>
    `${formatBoardDay(d, now, org.timezone)} ${formatBoardTime(d, org.timezone)}`;
  const members = await Promise.all(
    memberships.map(async (m) => ({
      id: m.id,
      name: await getUserDisplayName(m.clerkUserId),
    })),
  );
  const desk = (s: string): s is (typeof DESK_SERVICES)[number] =>
    (DESK_SERVICES as readonly string[]).includes(s);

  return (
    <DealDeskSettings
      initial={{
        services: org.dealServicesEnabled.filter(desk),
        contactSlaMinutes: String(org.contactSlaMinutes),
        dealRefPrefix: org.dealRefPrefix,
        dealAlertEmails: org.dealAlertEmails,
        dealDefaultOwnerId: org.dealDefaultOwnerId,
        rateLockMinutes: String(org.rateLockMinutes),
        payoutTargetMinutes: String(org.payoutTargetMinutes),
        cryptoMinQty: org.cryptoMinQty.toFixed(),
        cryptoMaxUsd: org.cryptoMaxUsd.toFixed(),
        payoutAlertEmails: org.payoutAlertEmails,
      }}
      orgName={org.name}
      members={members}
      accounts={accounts.map((a) => ({
        ...a,
        services: a.services.filter(desk),
      }))}
      wallets={wallets.map((w) => ({
        id: w.id,
        ticker: w.ticker,
        network: w.network,
        address: w.address,
        minConfirmations: w.minConfirmations,
        active: w.active,
        // "Watching" = the last successful check; a later failure warns.
        watching:
          w.lastFailedAt &&
          (!w.lastCheckedAt || w.lastFailedAt > w.lastCheckedAt)
            ? {
                tone: "warn" as const,
                text: `Check failed ${at(w.lastFailedAt)}`,
              }
            : w.lastCheckedAt
              ? {
                  tone: "ok" as const,
                  text: `Watching · ${at(w.lastCheckedAt)}`,
                }
              : { tone: "idle" as const, text: "Not checked yet" },
      }))}
      emailReady={!!process.env.RESEND_API_KEY && !!process.env.DEAL_ALERT_FROM}
    />
  );
}
