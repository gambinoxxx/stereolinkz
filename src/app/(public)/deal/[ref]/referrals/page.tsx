import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReferrerView } from "@/features/referrals/components/customer/ReferrerView";
import { referrerByDeal } from "@/features/referrals/referrer-queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your referrals · Stereolinkz" };

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

// "View my referrals" from a completed deal's tracking page: the deal's
// own tracking token opens the referrals of that deal's number, nothing
// else. Anything wrong is the same 404 as the tracking page.
export default async function DealReferralsPage({
  params,
  searchParams,
}: PageProps<"/deal/[ref]/referrals">) {
  const { ref } = await params;
  const token = first((await searchParams).t) ?? null;
  const view = await referrerByDeal(ref, token);
  if (!view) notFound();
  return <ReferrerView view={view} />;
}
