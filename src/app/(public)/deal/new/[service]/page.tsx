import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DealForm } from "@/features/deals/components/customer/DealForm";
import { DEAL_COPY } from "@/features/deals/content";
import { getDealDeskContext } from "@/features/deals/public-queries";
import {
  FORM_SLUGS,
  isFormEnabled,
  isFormSlug,
} from "@/features/deals/services";
import { whatsappLink } from "@/features/public/whatsapp";

// Cached (ISR), like the landing page: nothing per visitor is in the HTML
// (the form fetches its signed timestamp when it opens, and reads the
// calculator's ?amount= in the browser). Generating a board or changing
// Settings refreshes it at once (revalidatePublicPages); at most an hour
// old otherwise.
export const revalidate = 3600;

export function generateStaticParams() {
  return FORM_SLUGS.map((service) => ({ service }));
}

export async function generateMetadata({
  params,
}: PageProps<"/deal/new/[service]">): Promise<Metadata> {
  const { service } = await params;
  return {
    title: `${isFormSlug(service) ? DEAL_COPY.forms[service].title : "Start a deal"} · Stereolinkz`,
  };
}

export default async function DealFormPage({
  params,
}: PageProps<"/deal/new/[service]">) {
  const { service } = await params;
  const ctx = await getDealDeskContext();
  // Unknown and switched-off services are simply not here.
  if (
    !ctx ||
    !isFormSlug(service) ||
    !isFormEnabled(service, ctx.org.servicesEnabled)
  )
    notFound();

  return (
    <DealForm
      slug={service}
      enabled={ctx.org.servicesEnabled}
      forex={ctx.forex}
      pof={ctx.pof}
      referralServices={ctx.org.referralServices}
      cashLink={whatsappLink(
        ctx.org.contactLine,
        `Hi ${ctx.org.name}, I’d like to ask about cash forex`,
      )}
    />
  );
}
