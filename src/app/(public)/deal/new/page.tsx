import {
  ArrowRight,
  Banknote,
  FileText,
  Globe2,
  GraduationCap,
  MessageCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { compareDecimalStrings } from "@/lib/decimal";
import { formatBoardPrice, formatRate } from "@/lib/format";
import { whatsappLink } from "@/features/public/whatsapp";
import { DEAL_COPY } from "@/features/deals/content";
import { getDealDeskContext } from "@/features/deals/public-queries";
import {
  FORM_SLUGS,
  type FormSlug,
  isFormEnabled,
} from "@/features/deals/services";

export const metadata: Metadata = { title: "Start a deal · Stereolinkz" };
// The list follows Settings → Deal desk straight away.
export const dynamic = "force-dynamic";

const ICONS = {
  "school-fees": GraduationCap,
  "pay-abroad": Globe2,
  pof: FileText,
  forex: Banknote,
} satisfies Record<FormSlug, unknown>;

// deal-start.html: the services that are switched on, with a tag from the
// latest boards. Crypto arrives in Phase 13.
export default async function DealStartPage() {
  const ctx = await getDealDeskContext();
  const enabled = ctx
    ? FORM_SLUGS.filter((slug) => isFormEnabled(slug, ctx.org.servicesEnabled))
    : [];
  const brand = ctx?.org.name ?? "Stereolinkz";
  const cashLink = whatsappLink(
    ctx?.org.contactLine ?? null,
    `Hi ${brand}, I’d like to ask about cash forex`,
  );

  const fx0 = ctx?.forex?.rows[0];
  const pofMin = ctx?.pof?.rows.reduce<string | null>(
    (min, r) =>
      min === null || compareDecimalStrings(r.rate, min) < 0 ? r.rate : min,
    null,
  );
  const tags: Record<FormSlug, string | null> = {
    "school-fees": "Same day",
    "pay-abroad": "Same day · T+1",
    pof: pofMin ? `From ${formatBoardPrice(pofMin)}% / month` : null,
    forex: fx0
      ? `${fx0.code} ₦${formatRate(fx0.buy)} / ₦${formatRate(fx0.sell)}`
      : null,
  };
  const c = DEAL_COPY.start;

  return (
    <main className="page">
      <span className="crumb">{c.crumb}</span>
      <h1>{c.title}</h1>
      <p className="lead">{c.lead}</p>
      {enabled.length === 0 ? (
        <div className="closed">
          <h2>{c.closed}</h2>
          <p>{c.closedSub}</p>
          <a
            className="btn vio"
            href={whatsappLink(ctx?.org.contactLine ?? null, `Hi ${brand}`)}
            target="_blank"
            rel="noopener"
          >
            <MessageCircle size={20} strokeWidth={2.2} aria-hidden="true" />
            Chat on WhatsApp
          </a>
        </div>
      ) : (
        <div className="svcs">
          {enabled.map((slug) => {
            const Icon = ICONS[slug];
            return (
              <Link
                key={slug}
                className={`svc c-${slug}`}
                href={`/deal/new/${slug}`}
              >
                <span className="ic" aria-hidden="true">
                  <Icon size={28} strokeWidth={2} />
                </span>
                <span className="tx">
                  <b>{DEAL_COPY.cards[slug].title}</b>
                  <small>{DEAL_COPY.cards[slug].body}</small>
                </span>
                {tags[slug] && <span className="tag">{tags[slug]}</span>}
                <span className="go" aria-hidden="true">
                  <ArrowRight size={20} strokeWidth={2.2} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <div className="how3">
        {c.how.map((step, i) => (
          <div key={step.title}>
            <i>{i + 1}</i>
            <b>{step.title}</b>
            <small>{step.body}</small>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 22, color: "var(--ink2)", fontSize: 14.5 }}>
        Need cash forex?{" "}
        <a
          href={cashLink}
          target="_blank"
          rel="noopener"
          style={{ color: "var(--violet)", fontWeight: 750 }}
        >
          Ask us on WhatsApp
        </a>
        . {c.cash}
      </p>
    </main>
  );
}
