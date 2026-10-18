import {
  ArrowRight,
  Banknote,
  CircleDollarSign,
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
import { getCryptoDesk } from "@/features/crypto-deposits/public-queries";
import { DEAL_COPY } from "@/features/deals/content";
import { getDealDeskContext } from "@/features/deals/public-queries";
import {
  FORM_SLUGS,
  type FormSlug,
  isFormEnabled,
} from "@/features/deals/services";

export const metadata: Metadata = { title: "Start a deal · Stereolinkz" };
// Cached (ISR): Settings, wallet changes and board generation refresh it
// at once (revalidatePublicPages); at most an hour old otherwise.
export const revalidate = 3600;

const ICONS = {
  "school-fees": GraduationCap,
  "pay-abroad": Globe2,
  pof: FileText,
  forex: Banknote,
} satisfies Record<FormSlug, unknown>;

// deal-start.html: the services that are switched on, with a tag from the
// latest boards. Sell crypto shows while it is on and a coin can be watched
// (an official token with a wallet, on the latest Crypto board).
export default async function DealStartPage() {
  const ctx = await getDealDeskContext();
  const enabled = ctx
    ? FORM_SLUGS.filter((slug) => isFormEnabled(slug, ctx.org.servicesEnabled))
    : [];
  const desk =
    ctx && ctx.org.servicesEnabled.includes("CRYPTO_SELL")
      ? await getCryptoDesk(ctx.org.id, { livePrices: false })
      : null;
  const coins = desk?.coins ?? [];
  // "USDT on TRC20 and Bitcoin (BTC)": a stablecoin with its networks,
  // a chain's own coin by its name.
  const coinPhrase = (c: (typeof coins)[number]) =>
    c.pricing === "MARKET"
      ? `${c.name} (${c.ticker})`
      : `${c.ticker} on ${c.networks.map((n) => n.network).join(" or ")}`;
  const cryptoCard = coins.length > 0 && {
    body: `${coins.map(coinPhrase).join(" and ")}. Paid out minutes after your deposit confirms.`,
    tag: `${coins[0]!.ticker} ₦${formatRate(coins[0]!.rate)}`,
  };

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
      {enabled.length === 0 && !cryptoCard ? (
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
          {cryptoCard && (
            <Link className="svc c-crypto" href="/deal/new/crypto">
              <span className="ic" aria-hidden="true">
                <CircleDollarSign size={28} strokeWidth={2} />
              </span>
              <span className="tx">
                <b>Sell crypto</b>
                <small>{cryptoCard.body}</small>
              </span>
              <span className="tag">{cryptoCard.tag}</span>
              <span className="go" aria-hidden="true">
                <ArrowRight size={20} strokeWidth={2.2} />
              </span>
            </Link>
          )}
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
