import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DealDetail } from "@/features/deals/components/admin/DealDetail";
import { getDealForTeam, listMembers } from "@/features/deals/queries";
import { normalizeRef } from "@/features/deals/refs";
import { requireMember } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { formatBoardDay, formatBoardTime } from "@/lib/format";

export async function generateMetadata({
  params,
}: PageProps<"/admin/deals/[ref]">): Promise<Metadata> {
  const { ref } = await params;
  return { title: `${normalizeRef(ref) ?? "Deal"} · RateBoard` };
}

// deal-detail.html: one deal, scoped to the member's organization.
export default async function DealDetailPage({
  params,
}: PageProps<"/admin/deals/[ref]">) {
  const { organizationId } = await requireMember();
  const ref = normalizeRef((await params).ref);
  if (!ref) notFound();
  const [deal, members, org] = await Promise.all([
    getDealForTeam(organizationId, ref),
    listMembers(organizationId),
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true, timezone: true, contactSlaMinutes: true },
    }),
  ]);
  if (!deal) notFound();
  const now = new Date();
  // Labels are worked out here (org time zone) and passed as strings.
  const when = Object.fromEntries(
    [
      deal.createdAt,
      deal.statusChangedAt,
      deal.agreedAt,
      ...deal.events.map((e) => e.createdAt),
      ...deal.files.map((f) => f.createdAt),
    ]
      .filter((v): v is string => !!v)
      .map((iso) => [
        iso,
        `${formatBoardDay(new Date(iso), now, org.timezone)}, ${formatBoardTime(new Date(iso), org.timezone)}`,
      ]),
  );
  const time = Object.fromEntries(
    Object.keys(when).map((iso) => [
      iso,
      formatBoardTime(new Date(iso), org.timezone),
    ]),
  );
  return (
    <DealDetail
      deal={deal}
      members={members}
      orgName={org.name}
      labels={{ when, time }}
      slaMinutes={org.contactSlaMinutes}
    />
  );
}
