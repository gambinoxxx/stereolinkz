import {
  ArrowRight,
  Check,
  CircleDollarSign,
  GraduationCap,
  MessageCircle,
  Send,
} from "lucide-react";
import type { CSSProperties } from "react";

import { BoardScreen } from "@/features/public/components/BoardScreen";
import { Calculator } from "@/features/public/components/Calculator";
import { CoinRain } from "@/features/public/components/CoinRain";
import { FaqList } from "@/features/public/components/FaqList";
import { Globe } from "@/features/public/components/Globe";
import { HeroStage } from "@/features/public/components/HeroStage";
import { Mega } from "@/features/public/components/Mega";
import { MotionRoot } from "@/features/public/components/MotionRoot";
import {
  type RateTab,
  RatesPanel,
} from "@/features/public/components/RatesPanel";
import { Rotator } from "@/features/public/components/Rotator";
import { Services } from "@/features/public/components/Services";
import { SiteNav } from "@/features/public/components/SiteNav";
import { SplitHeading } from "@/features/public/components/SplitHeading";
import { type ChatMessage, Steps } from "@/features/public/components/Steps";
import { Ticker } from "@/features/public/components/Ticker";
import { TiltCard } from "@/features/public/components/TiltCard";
import { UpdatedLabel } from "@/features/public/components/UpdatedLabel";
import { WhatsAppLink } from "@/features/public/components/WhatsAppLink";
import { Wordmark } from "@/features/public/components/Wordmark";
import { type Faq, content } from "@/features/public/content";
import type { PublicLanding } from "@/features/public/landing-data";
import { buildLandingView } from "@/features/public/landing-view";
import { whatsappLink } from "@/features/public/whatsapp";

const DEFAULT_TIME_ZONE = "Africa/Lagos";

// The public landing page (docs/design/landing.html). A server component:
// everything here is static HTML; the motion lives in small client
// components that get plain props. Optional content (reviews, payout
// time, legal line, location) renders only when set in content.ts.
export function Landing({ data }: { data: PublicLanding }) {
  const { org, forex, crypto, pof } = data;
  const view = buildLandingView(data);
  const brand = org?.name ?? content.brand;
  const contact = org?.contactLine ?? null;
  const timeZone = org?.timezone ?? DEFAULT_TIME_ZONE;
  const chat = whatsappLink(contact, content.messages.hello);
  const feesChat = whatsappLink(contact, content.messages.schoolFees);
  const fx = view.fxExample;
  const fee = view.feeExample;

  // Brand colours from Settings; the stylesheet's own values otherwise.
  const brandVars = {
    ...(org?.primaryColor && { "--violet": org.primaryColor }),
    ...(org?.accentColor && { "--gold": org.accentColor }),
    ...(org?.backgroundColor && { "--deep": org.backgroundColor }),
  } as CSSProperties;

  const newest = [forex, crypto, pof]
    .filter((b) => b !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const tabs: RateTab[] = [
    ...(forex
      ? [
          {
            key: "forex" as const,
            label: "Forex",
            disclaimer: content.rates.disclaimers.forex,
            ...forex,
          },
        ]
      : []),
    ...(crypto
      ? [
          {
            key: "crypto" as const,
            label: "Crypto",
            disclaimer: content.rates.disclaimers.crypto,
            ...crypto,
          },
        ]
      : []),
    ...(pof
      ? [
          {
            key: "pof" as const,
            label: "POF",
            disclaimer: content.rates.disclaimers.pof,
            ...pof,
          },
        ]
      : []),
  ];

  const messages: ChatMessage[] = fx
    ? [
        {
          from: "me",
          text: `Hi, I want to sell ${fx.amount} ${fx.code} cash`,
          time: "10:31",
        },
        {
          from: "us",
          text: `Hello! Today we buy ${fx.code} at ${fx.rate}. For ${fx.amount} ${fx.code} you get ${fx.payout}. Shall we go ahead?`,
          time: "10:32",
        },
        { from: "me", text: "Yes please. Deposit done ✅", time: "10:36" },
        {
          from: "us",
          text: `Received, thank you. ${fx.payout} has been sent to your account 🎉`,
          time: "10:41",
        },
      ]
    : [
        {
          from: "me",
          text: "Hi, I’d like to sell some foreign currency",
          time: "10:31",
        },
        {
          from: "us",
          text: "Hello! Here’s today’s rate. How much would you like to sell?",
          time: "10:32",
        },
        { from: "me", text: "Done, deposit sent ✅", time: "10:36" },
        {
          from: "us",
          text: "Received, thank you. Your naira has been sent 🎉",
          time: "10:41",
        },
      ];

  const minutes = content.typicalPayoutMinutes;
  const faqs: Faq[] = [
    ...(minutes
      ? [
          {
            question: content.faq.payoutQuestion,
            answer: `Most payouts arrive within about ${minutes} minutes of us confirming your transfer, cash or coins. Large amounts can take a little longer, and we’ll tell you upfront.`,
          },
        ]
      : []),
    ...content.faq.items,
  ];

  const services = content.services;
  const hero = content.hero;

  return (
    <div className="lp" style={brandVars}>
      {/* Smooth anchor scrolling on this page only (a :has() selector on
          <html> would make Chrome re-check the whole page's style on every
          class change). Rendered by React, so it goes when the page does. */}
      <style>{`@media (prefers-reduced-motion: no-preference){html{scroll-behavior:smooth}}`}</style>
      <noscript>
        <style>{`.lp .rv,.lp .rrow,.lp .msg{opacity:1;transform:none}.lp .split .w>span{transform:none}`}</style>
      </noscript>
      <SiteNav chatHref={chat} />

      <main id="top">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="hero">
          <div className="blob b1" aria-hidden="true" />
          <div className="blob b2" aria-hidden="true" />
          <div className="blob b3" aria-hidden="true" />
          <div className="grain" aria-hidden="true" />
          <div className="wrap hero-in">
            <span className="eyebrow">
              <span className="live" aria-hidden="true" />
              {newest ? (
                <>
                  <span className="hide-sm">{hero.live} ·&nbsp;</span>
                  <UpdatedLabel
                    createdAt={newest.createdAt}
                    timeZone={timeZone}
                    timeLabel={newest.timeLabel}
                  />
                </>
              ) : (
                hero.noBoard
              )}
            </span>
            <h1
              aria-label={`${hero.headline.join(" ")} ${hero.headlineAccent}`}
            >
              {hero.headline.map((word, i) => (
                <span key={i} aria-hidden="true">
                  <span className="w">
                    <span style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
                      {word}
                    </span>
                  </span>
                  {i === 2 ? <br /> : " "}
                </span>
              ))}
              <span className="w" aria-hidden="true">
                <span
                  className="grad"
                  style={{
                    animationDelay: `${0.15 + hero.headline.length * 0.08}s`,
                  }}
                >
                  {hero.headlineAccent}
                </span>
              </span>
            </h1>
            <Rotator lead={hero.rotatorLead} phrases={view.rotator} />
            <div className="ctas">
              <WhatsAppLink href={chat} variant="vio">
                {hero.primaryCta}
              </WhatsAppLink>
              <a className="btn ghost mag" href="#rates">
                {hero.secondaryCta}
                <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
              </a>
            </div>
          </div>
          <HeroStage
            screen={
              <BoardScreen
                image={forex?.image ?? null}
                alt={
                  forex ? `Today’s forex rates board, ${forex.dateLabel}` : ""
                }
                label="Today’s rates"
                preload
              />
            }
            notes={
              <>
                {fx && (
                  <div className="note n1">
                    <span className="ic ok">
                      <Check size={18} strokeWidth={3} />
                    </span>
                    <span>
                      <small>
                        {fx.amount} {fx.code} at {fx.rate}
                      </small>
                      <span className="num">{fx.payout}</span>
                    </span>
                  </div>
                )}
                {view.cxExample && (
                  <div className="note n2">
                    <span className="ic vio">
                      <CircleDollarSign size={18} strokeWidth={2.2} />
                    </span>
                    <span>
                      <small>
                        {view.cxExample.amount} of {view.cxExample.ticker}
                      </small>
                      <span className="num">{view.cxExample.payout}</span>
                    </span>
                  </div>
                )}
                <div className="note n3">
                  <span className="ic gold">
                    <GraduationCap size={18} strokeWidth={2.2} />
                  </span>
                  <span>
                    <small>{hero.schoolFeesNote.title}</small>
                    {hero.schoolFeesNote.body}
                  </span>
                </div>
              </>
            }
          />
        </section>

        {/* ── Tickers ──────────────────────────────────────────── */}
        <div className={`tickers${view.rateTicker.length ? "" : " solo"}`}>
          <Ticker
            items={view.rateTicker}
            speed={0.6}
            label={`Buy rates: ${view.rateTicker.map((t) => `${t.lead} ${t.bold}`).join(", ")}`}
          />
          <Ticker
            items={view.serviceTicker}
            speed={-0.45}
            alt
            label={view.serviceTicker
              .map((t) => `${t.lead} ${t.bold}`)
              .join(". ")}
          />
        </div>

        {/* ── Services (pinned) ───────────────────────────────── */}
        <Services
          kicker={services.kicker}
          items={[
            {
              tag: services.forex.tag,
              title: view.forexTitle,
              body: services.forex.body,
              facts: view.forexFacts,
            },
            {
              tag: services.crypto.tag,
              title: view.cryptoTitle,
              body: services.crypto.body,
              facts: view.cryptoFacts,
            },
            {
              tag: services.pof.tag,
              title: services.pof.title,
              body: services.pof.body,
              facts: view.pofFacts,
            },
            {
              tag: services.abroad.tag,
              title: services.abroad.title,
              body: services.abroad.body,
              facts: services.abroad.facts,
            },
          ]}
          screens={[
            <BoardScreen
              key="fx"
              image={forex?.image ?? null}
              alt=""
              label="Forex rates"
            />,
            <BoardScreen
              key="cx"
              image={crypto?.image ?? null}
              alt=""
              label="Crypto rates"
            />,
            <BoardScreen
              key="pof"
              image={pof?.image ?? null}
              alt=""
              label="Proof of funds"
            />,
            <div key="receipt" className="receipt-fit">
              <div className="receipt">
                <div className="rh">
                  <Wordmark scale={0.75} />
                  <span className="ex">{content.fees.example.tag}</span>
                </div>
                <div className="ok">
                  <Check size={30} strokeWidth={3} />
                </div>
                <p className="rt">Payment delivered</p>
                {fee && <div className="amt num">{fee.amount}</div>}
                <div className="ln">
                  <span>To</span>
                  <span>University abroad</span>
                </div>
                {fee && (
                  <>
                    <div className="ln">
                      <span>Rate</span>
                      <span className="num">{fee.rate}</span>
                    </div>
                    <div className="ln">
                      <span>You paid</span>
                      <span className="num">{fee.total}</span>
                    </div>
                  </>
                )}
                <div className="ln">
                  <span>Delivered</span>
                  <span>{content.fees.example.delivery}</span>
                </div>
              </div>
            </div>,
          ]}
        />

        {/* ── Rates and calculator ─────────────────────────────── */}
        <section className="rates pad" id="rates">
          <div className="wrap">
            <p className="kicker rv">{content.rates.kicker}</p>
            <SplitHeading text={content.rates.title} />
            <p className="sub rv">{content.rates.sub}</p>
            {view.hasRates ? (
              <div
                className={`rates-grid${view.calcOptions.length ? "" : " solo"}`}
              >
                <RatesPanel tabs={tabs} timeZone={timeZone} />
                {view.calcOptions.length > 0 && (
                  <Calculator
                    options={view.calcOptions}
                    brand={brand}
                    contactLine={contact}
                  />
                )}
              </div>
            ) : (
              <div className="rates-empty rv">
                <h3>{content.rates.empty}</h3>
                <p>{content.rates.emptySub}</p>
                <WhatsAppLink href={chat} variant="vio">
                  {hero.primaryCta}
                </WhatsAppLink>
              </div>
            )}
          </div>
        </section>

        {/* ── Payments abroad ──────────────────────────────────── */}
        <section className="world pad" id="world">
          <div className="wrap grid2">
            <div>
              <p className="kicker rv">{content.world.kicker}</p>
              <SplitHeading text={content.world.title} />
              <p className="sub rv">{content.world.sub}</p>
              <div className="wstats">
                {content.world.stats.map((s) => (
                  <div className="wstat rv" key={s.label}>
                    <b>{s.value}</b>
                    <span>{s.label}</span>
                  </div>
                ))}
                {minutes && (
                  <div className="wstat rv">
                    <b className="num">{minutes}</b>
                    <span>{content.world.payoutLabel}</span>
                  </div>
                )}
              </div>
            </div>
            <Globe cities={content.world.cities} home={content.world.home} />
          </div>
        </section>

        {/* ── School fees ──────────────────────────────────────── */}
        <section className="fees pad" id="fees">
          <div className="wrap grid2">
            <div>
              <p className="kicker rv">{content.fees.kicker}</p>
              <SplitHeading text={content.fees.title} />
              <p className="sub rv">{content.fees.sub}</p>
              <ul className="ticks">
                {content.fees.ticks.map((t) => (
                  <li className="rv" key={t}>
                    <span aria-hidden="true">
                      <Check size={16} strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="rv fees-cta">
                <WhatsAppLink href={feesChat} variant="pri">
                  {content.fees.cta}
                </WhatsAppLink>
              </div>
            </div>
            <TiltCard>
              <div className="inv">
                <div className="top">
                  <Wordmark scale={0.85} />
                  <span className="tag">{content.fees.example.tag}</span>
                </div>
                <p className="it">{content.fees.example.title}</p>
                {fee && <div className="amt num">{fee.amount}</div>}
                {fee && (
                  <>
                    <div className="line">
                      <span>Rate</span>
                      <span className="num">{fee.rate}</span>
                    </div>
                    <div className="line">
                      <span>You pay</span>
                      <span className="num">{fee.total}</span>
                    </div>
                  </>
                )}
                <div className="line">
                  <span>Delivery</span>
                  <span>{content.fees.example.delivery}</span>
                </div>
                <div className="prog" aria-hidden="true">
                  <i />
                </div>
                <div className="status">
                  <Check size={16} strokeWidth={3} aria-hidden="true" />
                  {content.fees.example.status}
                </div>
              </div>
              <span className="float3d cap" aria-hidden="true">
                <GraduationCap size={40} strokeWidth={2} />
              </span>
              <span className="float3d plane" aria-hidden="true">
                <Send size={34} strokeWidth={2} />
              </span>
            </TiltCard>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="steps pad" id="how">
          <div className="wrap">
            <p className="kicker rv">{content.steps.kicker}</p>
            <SplitHeading text={content.steps.title} />
            <Steps
              steps={content.steps.list}
              messages={messages}
              restartLabel={content.steps.restart}
              chatLabel={content.steps.chatLabel}
              brand={brand}
            />
          </div>
        </section>

        <Mega words={content.mega} />

        {/* ── Reviews: only real ones, only when given ─────────── */}
        {content.reviews && content.reviews.length > 0 && (
          <section className="reviews" aria-labelledby="reviews-title">
            <div className="wrap">
              <p className="kicker rv">{content.reviewsSection.kicker}</p>
              <SplitHeading
                text={content.reviewsSection.title}
                id="reviews-title"
              />
            </div>
            <div className="rmq-wrap">
              {[false, true].map((rev) => (
                <div key={String(rev)} className={`rmq${rev ? " rev" : ""}`}>
                  {[0, 1].map((copy) =>
                    (rev
                      ? [...content.reviews!].reverse()
                      : content.reviews!
                    ).map((r, i) => (
                      <figure
                        className="rc"
                        key={`${copy}-${i}`}
                        aria-hidden={copy === 1 || rev ? true : undefined}
                      >
                        <span className="stars" aria-hidden="true">
                          ★★★★★
                        </span>
                        <blockquote>“{r.quote}”</blockquote>
                        <figcaption className="by">
                          <span className={`av av${i % 6}`} aria-hidden="true">
                            {r.name.charAt(0)}
                          </span>
                          <span>
                            <b>{r.name}</b>
                            <small>{r.detail}</small>
                          </span>
                        </figcaption>
                      </figure>
                    )),
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section className="faq pad" id="faq">
          <div className="wrap grid2">
            <div>
              <p className="kicker rv">{content.faq.kicker}</p>
              <SplitHeading text={content.faq.title} />
              <p className="sub rv">{content.faq.sub}</p>
            </div>
            <FaqList items={faqs} />
          </div>
        </section>

        {/* ── Closing call to action ───────────────────────────── */}
        <section className="cta">
          <div className="wrap">
            <div className="box rv">
              <CoinRain />
              <SplitHeading text={content.cta.title} />
              <p>{content.cta.body}</p>
              <WhatsAppLink href={chat} variant="gold">
                {content.cta.button}
              </WhatsAppLink>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="fgrid">
            <div>
              <Wordmark scale={1.2} />
              <p className="about">{content.footer.about}</p>
            </div>
            <nav aria-label="Services">
              <h2 className="h5">Services</h2>
              <ul>
                {content.footer.services.map((l) => (
                  <li key={l.label}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Company">
              <h2 className="h5">Company</h2>
              <ul>
                {content.footer.company.map((l) => (
                  <li key={l.label}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <div>
              <h2 className="h5">Contact</h2>
              <ul>
                <li>
                  <a href={chat} target="_blank" rel="noopener">
                    {contact ? `WhatsApp ${contact}` : "Chat on WhatsApp"}
                  </a>
                </li>
                {org?.email && (
                  <li>
                    <a href={`mailto:${org.email}`}>{org.email}</a>
                  </li>
                )}
                {content.location && <li>{content.location}</li>}
              </ul>
            </div>
          </div>
          <div className="legal">
            <p>{content.footer.disclaimer}</p>
            {content.legalLine && <p>{content.legalLine}</p>}
            <p>
              © {new Date().getFullYear()} {brand}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <div className="fab">
        <a
          className="btn vio"
          href={chat}
          target="_blank"
          rel="noopener"
          aria-label="Chat on WhatsApp"
        >
          <MessageCircle strokeWidth={2.2} aria-hidden="true" />
          Chat
        </a>
      </div>

      <MotionRoot />
    </div>
  );
}
