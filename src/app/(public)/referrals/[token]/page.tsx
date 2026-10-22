import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReferrerView } from "@/features/referrals/components/customer/ReferrerView";
import { referrerByPageToken } from "@/features/referrals/referrer-queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your referrals · Stereolinkz" };

// The private link from the code email or the team's "New private link".
// A wrong, old or switched-off token is the same "Link not found".
export default async function ReferralsPage({
  params,
}: PageProps<"/referrals/[token]">) {
  const { token } = await params;
  const view = await referrerByPageToken(token);
  if (!view) notFound();
  return <ReferrerView view={view} />;
}
