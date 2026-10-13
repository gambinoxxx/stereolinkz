import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DealForm } from "@/features/deals/components/customer/DealForm";
import { DEAL_COPY } from "@/features/deals/content";
import { getDealDeskContext } from "@/features/deals/public-queries";
import { issueFormToken } from "@/features/deals/security";
import { isFormEnabled, isFormSlug } from "@/features/deals/services";
import { whatsappLink } from "@/features/public/whatsapp";

// Each visit gets a freshly signed form timestamp, and the form follows
// the Settings switches at once.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/deal/new/[service]">): Promise<Metadata> {
  const { service } = await params;
  return {
    title: `${isFormSlug(service) ? DEAL_COPY.forms[service].title : "Start a deal"} · Stereolinkz`,
  };
}

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function DealFormPage({
  params,
  searchParams,
}: PageProps<"/deal/new/[service]">) {
  const { service } = await params;
  const query = await searchParams;
  const ctx = await getDealDeskContext();
  // Unknown and switched-off services are simply not here.
  if (
    !ctx ||
    !isFormSlug(service) ||
    !isFormEnabled(service, ctx.org.servicesEnabled)
  )
    notFound();

  const amount = first(query.amount);
  const currency = first(query.currency)?.toUpperCase();
  const dir = first(query.dir);
  return (
    <DealForm
      slug={service}
      enabled={ctx.org.servicesEnabled}
      forex={ctx.forex}
      pof={ctx.pof}
      formToken={issueFormToken()}
      cashLink={whatsappLink(
        ctx.org.contactLine,
        `Hi ${ctx.org.name}, I’d like to ask about cash forex`,
      )}
      prefill={{
        amount: amount && /^[\d,.\s]{1,16}$/.test(amount) ? amount : undefined,
        currency:
          currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined,
        dir: dir === "buy" || dir === "sell" ? dir : undefined,
      }}
    />
  );
}
