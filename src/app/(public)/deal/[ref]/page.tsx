import { Check, ChevronRight, MessageCircle, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CryptoDealView } from "@/features/crypto-deposits/components/CryptoDealView";
import { getCryptoDealForCustomer } from "@/features/crypto-deposits/customer-queries";
import { findDealIdByToken } from "@/features/deals/access";
import { AutoRefresh } from "@/features/deals/components/customer/AutoRefresh";
import { CopyButton } from "@/features/deals/components/customer/CopyButton";
import { IvePaid } from "@/features/deals/components/customer/IvePaid";
import {
  INTL_PURPOSE_LABELS,
  POF_PURPOSE_LABELS,
  SCHOOL_PURPOSE_LABELS,
} from "@/features/deals/content";
import {
  type CustomerDeal,
  getDealForCustomer,
} from "@/features/deals/customer-queries";
import {
  amountToPayText,
  dealAmountText,
  nairaText,
  rateText,
} from "@/features/deals/format";
import {
  aboutDealMessage,
  continueMessage,
  paidMessage,
} from "@/features/deals/messages";
import { customerStatus, dealSteps } from "@/features/deals/progress";
import { getDealDeskContext } from "@/features/deals/public-queries";
import { SERVICE_LABELS } from "@/features/deals/services";
import { formatAccountNumber } from "@/features/deals/settings-schema";
import { whatsappLink } from "@/features/public/whatsapp";
import { ReferralCard } from "@/features/referrals/components/customer/ReferralCard";
import { cardForDeal } from "@/features/referrals/referrer-queries";
import { customerEmailReady } from "@/lib/server/email";
import { formatBoardDay, formatBoardTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your deal · Stereolinkz" };

const TZ = "Africa/Lagos";
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

function when(iso: string, now: Date) {
  const date = new Date(iso);
  return `${formatBoardDay(date, now, TZ)}, ${formatBoardTime(date, TZ)}`;
}

function title(d: CustomerDeal): string {
  const det = d.details;
  const amount = dealAmountText(d.service, d.amount, d.currency);
  switch (det?.service) {
    case "SCHOOL_FEES":
      return `School fees to ${det.schoolName}`;
    case "INTL_PAYMENT":
      return `Payment to ${det.country}`;
    case "POF":
      return `Proof of funds${det.bankName ? ` at ${det.bankName}` : ""}`;
    case "FOREX_SELL":
      return `Sell ${amount}`;
    case "FOREX_BUY":
      return `Buy ${amount}`;
    default:
      return SERVICE_LABELS[d.service];
  }
}

function purpose(d: CustomerDeal): string | null {
  const det = d.details;
  if (det?.service === "SCHOOL_FEES") return SCHOOL_PURPOSE_LABELS[det.purpose];
  if (det?.service === "INTL_PAYMENT") return INTL_PURPOSE_LABELS[det.purpose];
  if (det?.service === "POF")
    return `${POF_PURPOSE_LABELS[det.purpose]} · ${det.months} month${det.months > 1 ? "s" : ""}`;
  return null;
}

// deal-submitted.html (first visit, ?new=1) and deal-track.html. Reached
// only with the deal's tracking token; anything else is the same 404.
export default async function DealPage({
  params,
  searchParams,
}: PageProps<"/deal/[ref]">) {
  const { ref } = await params;
  const query = await searchParams;
  const token = first(query.t) ?? null;
  const ctx = await getDealDeskContext();
  const dealId = ctx ? await findDealIdByToken(ctx.org.id, ref, token) : null;
  // The deal and its crypto view load together (only the token lookup has
  // to come first); the crypto view is used for crypto deals only.
  const [deal, cryptoView, card] =
    ctx && dealId
      ? await Promise.all([
          getDealForCustomer(dealId),
          getCryptoDealForCustomer(dealId),
          cardForDeal(ctx.org.id, dealId),
        ])
      : [null, null, null];
  if (!ctx || !deal || !token) notFound();
  // A completed deal's customer has their own referral code.
  const referralCard = card && (
    <ReferralCard
      brand={ctx.org.name}
      code={card.code}
      shareUrl={card.shareUrl}
      pct={card.pct}
      viewHref={`/deal/${deal.ref}/referrals?t=${encodeURIComponent(token)}`}
    />
  );

  // Crypto deals go straight to their deposit / payout page.
  if (deal.service === "CRYPTO_SELL") {
    const crypto = cryptoView;
    if (!crypto) notFound();
    return (
      <CryptoDealView
        deal={crypto}
        token={token}
        whatsappHref={whatsappLink(
          ctx.org.contactLine,
          aboutDealMessage(ctx.org.name, deal.ref),
        )}
        extra={referralCard}
      />
    );
  }

  const now = new Date();
  const brand = ctx.org.name;
  const contact = ctx.org.contactLine;
  const amount = dealAmountText(deal.service, deal.amount, deal.currency);
  const estimate = deal.quote
    ? `${nairaText(deal.quote.naira)} at ${rateText(deal.service, deal.quote.rate, deal.currency)}`
    : "We’ll quote on WhatsApp";
  const status = customerStatus(deal.service, deal.status);
  const selfLink = `/deal/${deal.ref}?t=${encodeURIComponent(token)}`;
  const continueHref = whatsappLink(contact, continueMessage(brand, deal));

  if (first(query.new) === "1") {
    const det = deal.details;
    const serviceLine =
      det?.service === "SCHOOL_FEES"
        ? `School fees · ${det.schoolName}`
        : det?.service === "POF" && det.bankName
          ? `Proof of funds · ${det.bankName}`
          : SERVICE_LABELS[deal.service];
    const emailSent = deal.hasEmail && customerEmailReady();
    return (
      <main className="page">
        <div className="done-wrap">
          <div className="burst" aria-hidden="true">
            <Check size={44} strokeWidth={3} />
          </div>
          <h1>Deal received.</h1>
          <p className="lead">
            Your deal number is below. Send it to us on WhatsApp and our team
            will confirm the final rate with you.
          </p>
          {first(query.upload) === "failed" && (
            <p
              className="note warn"
              style={{ marginTop: 18, textAlign: "left" }}
            >
              <ShieldAlert
                size={18}
                strokeWidth={2.2}
                aria-hidden="true"
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <span>
                Your file didn’t upload. Please send it to us on WhatsApp with
                your deal number.
              </span>
            </p>
          )}
          <section className="card">
            <span className="lbl" style={{ color: "var(--ink3)" }}>
              Your deal number
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              <span className="big-ref">{deal.ref}</span>
              <span className={`status ${status.tone}`}>
                <i />
                {status.label}
              </span>
            </div>
            <div className="kv">
              <div>
                <span>Service</span>
                <span>{serviceLine}</span>
              </div>
              <div>
                <span>Amount</span>
                <span className="num">{amount}</span>
              </div>
              <div>
                <span>Estimate</span>
                <span className="num">
                  {deal.quote
                    ? nairaText(deal.quote.naira)
                    : "We’ll quote on WhatsApp"}
                </span>
              </div>
            </div>
            <a
              className="btn vio block"
              style={{ marginTop: 20 }}
              href={continueHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={20} strokeWidth={2.2} aria-hidden="true" />
              Continue on WhatsApp
            </a>
            <div className="save">
              <Link className="btn ghost sm" href={selfLink}>
                Open my deal page{" "}
                <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
              </Link>
              <CopyButton
                className="btn ghost sm"
                link={selfLink}
                label="Copy my deal link"
              />
            </div>
            <p className="lead" style={{ fontSize: 14, marginTop: 14 }}>
              Save your deal link. It’s private: anyone with it can see this
              deal’s status.
              {emailSent ? " We also sent it to your email." : ""}
            </p>
          </section>
        </div>
      </main>
    );
  }

  const steps = dealSteps(
    deal.service,
    deal.status,
    new Date(deal.createdAt),
    deal.changes.map((c) => ({ toStatus: c.toStatus, at: new Date(c.at) })),
  );
  const toPay = amountToPayText(
    deal.service,
    deal.amount,
    deal.currency,
    deal.agreed?.naira ?? null,
  );
  const det = deal.details;
  const lead = [`${amount} for ${deal.customerName}`, purpose(deal)]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="page">
      <AutoRefresh />
      <div className="dhead">
        <div>
          <span className="ref">
            {deal.ref}{" "}
            <CopyButton
              value={deal.ref}
              label=""
              ariaLabel="Copy deal number"
            />
          </span>
          <h1 style={{ marginTop: 16 }}>{title(deal)}</h1>
          <p className="lead">{lead}</p>
        </div>
        <span className={`status ${status.tone}`}>
          <i />
          {status.label}
        </span>
      </div>
      <div className="grid">
        <div>
          {deal.payTo && toPay && (
            <section className="card">
              <h2>Pay this amount</h2>
              <p className="d">
                {deal.agreed?.at
                  ? `Agreed${deal.agreed.by ? ` with ${deal.agreed.by}` : ""} on WhatsApp at ${formatBoardTime(new Date(deal.agreed.at), TZ)}. `
                  : ""}
                Transfer from your banking app, then tap “I’ve paid”.
              </p>
              <div
                className="copyrow"
                style={{
                  marginTop: 18,
                  background: "var(--night)",
                  color: "#fff",
                }}
              >
                <div className="v">
                  <small style={{ color: "#B9A9E0" }}>Amount</small>
                  <span
                    className="num"
                    style={{ fontSize: 30, color: "var(--gold2)" }}
                  >
                    {toPay}
                  </span>
                </div>
                <CopyButton value={toPay.replace(/[^\d.]/g, "")} />
              </div>
              <div className="copyrow">
                <div className="v">
                  <small>Bank</small>
                  {deal.payTo.bank}
                </div>
              </div>
              <div className="copyrow">
                <div className="v">
                  <small>Account number</small>
                  <span className="num">
                    {formatAccountNumber(deal.payTo.accountNumber)}
                  </span>
                </div>
                <CopyButton value={deal.payTo.accountNumber} />
              </div>
              <div className="copyrow">
                <div className="v">
                  <small>Account name</small>
                  {deal.payTo.accountName}
                </div>
              </div>
              <div className="copyrow">
                <div className="v">
                  <small>Narration</small>
                  {deal.ref}
                </div>
                <CopyButton value={deal.ref} />
              </div>
              <div className="note warn" style={{ marginTop: 14 }}>
                <ShieldAlert
                  size={18}
                  strokeWidth={2.2}
                  aria-hidden="true"
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <span>
                  Only pay into the account on this page. We will never ask you
                  to pay into a different account on WhatsApp. If in doubt, call
                  us first.
                </span>
              </div>
              <IvePaid
                dealRef={deal.ref}
                token={token}
                paidAt={
                  deal.customerPaidAt ? when(deal.customerPaidAt, now) : null
                }
                whatsappHref={whatsappLink(
                  contact,
                  paidMessage(brand, deal.ref),
                )}
              />
            </section>
          )}
          <section className="card">
            <h2>Deal details</h2>
            <div className="kv">
              <div>
                <span>Website estimate</span>
                <span className="num">{estimate}</span>
              </div>
              {deal.agreed?.rate && (
                <div>
                  <span>Agreed rate</span>
                  <span className="num">
                    {rateText(deal.service, deal.agreed.rate, deal.currency)}
                  </span>
                </div>
              )}
              {deal.agreed?.feeNaira && deal.agreed.feeNaira !== "0" && (
                <div>
                  <span>Fee</span>
                  <span className="num">{nairaText(deal.agreed.feeNaira)}</span>
                </div>
              )}
              {deal.agreed?.naira && deal.service !== "FOREX_SELL" && (
                <div>
                  <span>Agreed total</span>
                  <span className="num">{nairaText(deal.agreed.naira)}</span>
                </div>
              )}
              {deal.agreed?.naira && deal.service === "FOREX_SELL" && (
                <div>
                  <span>You receive</span>
                  <span className="num">{nairaText(deal.agreed.naira)}</span>
                </div>
              )}
              {det?.service === "SCHOOL_FEES" && (
                <div>
                  <span>School</span>
                  <span>
                    {det.schoolName}, {det.country}
                  </span>
                </div>
              )}
              {det?.service === "INTL_PAYMENT" && (
                <div>
                  <span>Recipient’s country</span>
                  <span>{det.country}</span>
                </div>
              )}
              {deal.files.map((f) => (
                <div key={f.id}>
                  <span>{f.kind === "RECEIPT" ? "Receipt" : "Invoice"}</span>
                  <span>
                    <a
                      href={`/api/deals/${deal.ref}/files/${f.id}?t=${encodeURIComponent(token)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--violet)" }}
                    >
                      {f.name}
                    </a>
                  </span>
                </div>
              ))}
              {deal.contactName && (
                <div>
                  <span>Your team contact</span>
                  <span>{deal.contactName}</span>
                </div>
              )}
            </div>
          </section>
        </div>
        <aside>
          <section className="card">
            <h2>Progress</h2>
            {deal.status === "CANCELLED" && (
              <p className="note bad" style={{ marginTop: 14 }}>
                This deal was cancelled. Message us on WhatsApp if you’d like to
                start again.
              </p>
            )}
            <ol className="tl">
              {steps.map((s, i) => (
                <li key={s.status} className={s.state}>
                  <span className="dot">
                    {s.state === "done" ? (
                      <Check size={16} strokeWidth={3} aria-hidden="true" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span>
                    <b>{s.label}</b>
                    <small>
                      {s.at && s.state !== "todo"
                        ? when(s.at.toISOString(), now) +
                          (s.status === "AGREED" && deal.agreed?.rate
                            ? ` · ${rateText(deal.service, deal.agreed.rate, deal.currency)}`
                            : "")
                        : s.status === "AWAITING_PAYMENT" &&
                            toPay &&
                            s.state === "now"
                          ? `Pay ${toPay} to the account on this page`
                          : s.status === "PAYMENT_RECEIVED"
                            ? "We confirm it on our bank statement"
                            : ""}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
            <a
              className="btn ghost block"
              href={whatsappLink(contact, aboutDealMessage(brand, deal.ref))}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} strokeWidth={2.2} aria-hidden="true" />
              Message us about this deal
            </a>
          </section>
          {referralCard}
        </aside>
      </div>
    </main>
  );
}
