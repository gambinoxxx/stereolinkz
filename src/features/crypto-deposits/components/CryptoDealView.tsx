import { Check, MessageCircle, ShieldAlert } from "lucide-react";

import { AutoRefresh } from "@/features/deals/components/customer/AutoRefresh";
import { CopyButton } from "@/features/deals/components/customer/CopyButton";
import {
  DepositPoller,
  TxIdBox,
} from "@/features/crypto-deposits/components/DepositWatch";
import { LockTimer } from "@/features/crypto-deposits/components/LockTimer";
import { PayoutCountdown } from "@/features/crypto-deposits/components/PayoutCountdown";
import type { CustomerCryptoDeal } from "@/features/crypto-deposits/customer-queries";
import { addressQrSvg } from "@/features/crypto-deposits/qr";
import { NETWORKS } from "@/features/crypto-deposits/tokens";
import { nairaText } from "@/features/deals/format";
import { customerStatus } from "@/features/deals/progress";
import { formatBoardTime, formatRate } from "@/lib/format";

const TZ = "Africa/Lagos";
const time = (iso: string) => formatBoardTime(new Date(iso), TZ);

// "1500.5" → "1,500.50": coin amounts always show their cents.
function coins(qty: string): string {
  const [int = "0", frac = ""] = qty.split(".");
  return `${formatRate(int)}.${frac.padEnd(2, "0")}`;
}
const ends = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;

type Step = {
  title: string;
  sub: React.ReactNode;
  state: "done" | "now" | "todo";
};

function Timeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="tl">
      {steps.map((s, i) => (
        <li key={s.title} className={s.state}>
          <span className="dot">
            {s.state === "done" ? (
              <Check size={16} strokeWidth={3} aria-hidden="true" />
            ) : (
              i + 1
            )}
          </span>
          <span>
            <b>{s.title}</b>
            <small>{s.sub}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

// deal-crypto-deposit.html (waiting / seen), deal-crypto-payout.html
// (complete / paid out), and the expired, flagged and cancelled states.
export async function CryptoDealView({
  deal,
  token,
  whatsappHref,
}: {
  deal: CustomerCryptoDeal;
  token: string;
  whatsappHref: string;
}) {
  const net = NETWORKS[deal.network];
  // A lock that ended shows as such at once, before the watcher moves it.
  const status = customerStatus(
    "CRYPTO_SELL",
    deal.status === "AWAITING_DEPOSIT" && !deal.lockOpen
      ? "EXPIRED"
      : deal.status,
  );
  const qty = `${coins(deal.expectedQty)} ${deal.ticker}`;
  const naira = nairaText(deal.naira);
  const rate = `₦${formatRate(deal.rate)} per $1`;
  const account = `${deal.payout.bank} account ending ${deal.payout.last4}`;
  const short = `${deal.payout.bank} ••${deal.payout.last4}`;
  const message = (
    <a
      className="btn ghost block"
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
    >
      <MessageCircle size={18} strokeWidth={2.2} aria-hidden="true" />
      Message us about this deal
    </a>
  );
  const head = (h1: string, lead: React.ReactNode) => (
    <div className="dhead">
      <div>
        <span className="ref">
          {deal.ref}{" "}
          <CopyButton value={deal.ref} label="" ariaLabel="Copy deal number" />
        </span>
        <h1 style={{ marginTop: 16 }}>{h1}</h1>
        <p className="lead">{lead}</p>
      </div>
      <span className={`status ${status.tone}`}>
        <i />
        {status.label}
      </span>
    </div>
  );
  const explorer = deal.txHash ? (
    <a
      href={net.explorerTx(deal.txHash)}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "var(--violet)", fontWeight: 700 }}
    >
      view on {deal.network === "TRC20" ? "Tronscan" : "BscScan"}
    </a>
  ) : null;

  // ── Deposit complete / paid out ──────────────────────────────────────
  if (deal.status === "DEPOSIT_COMPLETE" || deal.status === "PAID_OUT") {
    const paid = deal.status === "PAID_OUT";
    return (
      <main className="page">
        {!paid && <AutoRefresh />}
        <div className="hero2">
          <span className="ref">{deal.ref}</span>
          <div className="okc" aria-hidden="true">
            <Check size={44} strokeWidth={3} />
          </div>
          <h1>{paid ? `${naira} sent!` : "Deposit complete."}</h1>
          <p className="lead" style={{ margin: "14px auto 0" }}>
            {paid && deal.paid ? (
              <>
                Paid to {deal.payout.name} · {short} · Ref{" "}
                <b>{deal.paid.reference}</b>
              </>
            ) : (
              <>
                {deal.receivedQty
                  ? coins(deal.receivedQty)
                  : coins(deal.expectedQty)}{" "}
                {deal.ticker} confirmed on {deal.network}. Your naira is on its
                way to {short}.
              </>
            )}
          </p>
          {!paid && deal.payoutDueAt && (
            <PayoutCountdown
              dueAt={deal.payoutDueAt}
              totalMinutes={deal.payoutMinutes}
            />
          )}
          <section
            className="card"
            style={{ textAlign: "left", marginTop: 30 }}
          >
            <Timeline
              steps={[
                {
                  title: "Deal created",
                  sub: `${time(deal.createdAt)} · rate locked at ₦${formatRate(deal.rate)}`,
                  state: "done",
                },
                {
                  title: "Deposit complete",
                  sub: (
                    <>
                      {deal.depositCompletedAt
                        ? `${time(deal.depositCompletedAt)} · `
                        : ""}
                      {deal.receivedQty
                        ? coins(deal.receivedQty)
                        : coins(deal.expectedQty)}{" "}
                      {deal.ticker} · {deal.minConfirmations}/
                      {deal.minConfirmations} confirmations
                      {explorer && <> · {explorer}</>}
                    </>
                  ),
                  state: "done",
                },
                {
                  title: paid ? "Naira paid out" : `Paying out ${naira}`,
                  sub: `${paid && deal.paid ? `${time(deal.paid.at)} · ` : ""}To ${short} (${deal.payout.name})`,
                  state: paid ? "done" : "now",
                },
              ]}
            />
            {message}
          </section>
        </div>
      </main>
    );
  }

  // ── Being checked / cancelled / lock ended ───────────────────────────
  if (
    deal.status === "FLAGGED" ||
    deal.status === "CANCELLED" ||
    !deal.lockOpen
  ) {
    const text =
      deal.status === "FLAGGED"
        ? "We’re checking your deposit. Our team will message you shortly."
        : deal.status === "CANCELLED"
          ? "This deal was cancelled. Message us on WhatsApp if you’d like to start again."
          : "Your rate lock ended. Message us on WhatsApp for a new rate.";
    return (
      <main className="page">
        <AutoRefresh />
        {head(
          `Sell ${qty} on ${deal.network}`,
          <>
            Estimate {naira} at {rate}.
          </>,
        )}
        <div className="grid">
          <div>
            <section className="card">
              <p
                className={`note ${deal.status === "CANCELLED" ? "bad" : "warn"}`}
              >
                <ShieldAlert
                  size={18}
                  strokeWidth={2.2}
                  aria-hidden="true"
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <span>{text}</span>
              </p>
              <a
                className="btn vio block"
                style={{ marginTop: 18 }}
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={20} strokeWidth={2.2} aria-hidden="true" />
                Continue on WhatsApp
              </a>
            </section>
          </div>
          <aside>
            <section className="card">
              <h2>Progress</h2>
              <Timeline
                steps={[
                  {
                    title: "Deal created",
                    sub: `${time(deal.createdAt)} · rate locked at ₦${formatRate(deal.rate)}`,
                    state: "done",
                  },
                  {
                    title:
                      deal.status === "FLAGGED"
                        ? "Deposit being checked"
                        : "Waiting for deposit",
                    sub: deal.depositSeenAt
                      ? `Seen ${time(deal.depositSeenAt)}`
                      : `Send ${qty} on ${deal.network}`,
                    state: deal.status === "FLAGGED" ? "now" : "todo",
                  },
                  {
                    title: "Naira paid out",
                    sub: `About ${deal.payoutMinutes} minutes after deposit`,
                    state: "todo",
                  },
                ]}
              />
            </section>
          </aside>
        </div>
      </main>
    );
  }

  // ── Waiting for the deposit / seen ───────────────────────────────────
  const address = deal.depositAddress!;
  const qr = await addressQrSvg(address);
  const seen = deal.status === "DEPOSIT_SEEN";
  const conf = deal.confirmations ?? 0;
  return (
    <main className="page">
      <DepositPoller dealRef={deal.ref} token={token} />
      {head(
        `Send ${qty} on ${deal.network}`,
        <>
          You’ll receive <b className="num">{naira}</b> in your {account}.
        </>,
      )}
      <div className="grid">
        <div>
          <section className="card">
            <h2>Deposit address</h2>
            <p className="d">
              Send exactly <b>{qty}</b> on the <b>{net.label}</b> network to
              this address.
            </p>
            <div className="depo">
              <div
                className="qr"
                role="img"
                aria-label="QR code of the deposit address"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <div>
                <div className="copyrow" style={{ marginTop: 0 }}>
                  <div className="v">
                    <small>Network</small>
                    {net.chain} ({deal.network}) · {deal.ticker}
                  </div>
                </div>
                <div className="copyrow">
                  <div className="v">
                    <small>Address</small>
                    <span className="addr">{address}</span>
                  </div>
                  <CopyButton value={address} />
                </div>
                <div className="copyrow">
                  <div className="v">
                    <small>Amount</small>
                    <span className="num">{qty}</span>
                  </div>
                  <CopyButton value={deal.expectedQty} />
                </div>
              </div>
            </div>
            <div className="note bad" style={{ marginTop: 16 }}>
              <ShieldAlert
                size={18}
                strokeWidth={2.2}
                aria-hidden="true"
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <span>
                <b>
                  Send only {deal.ticker} on {deal.network} to this address.
                </b>{" "}
                Other coins or networks can’t be recovered. Check the first and
                last 4 characters ({ends(address)}) after pasting.
              </span>
            </div>
          </section>
          {!seen && (
            <section className="card">
              <h2>Already sent it?</h2>
              <p className="d">
                Paste your transaction ID (TxID) from your wallet or exchange to
                speed things up. We also detect it automatically.
              </p>
              <TxIdBox dealRef={deal.ref} token={token} />
            </section>
          )}
        </div>
        <aside>
          {!seen && (
            <LockTimer
              expiresAt={deal.lockExpiresAt}
              totalMinutes={deal.lockMinutes}
              rateLabel={rate}
            />
          )}
          <section className="card" style={{ marginTop: seen ? 0 : 18 }}>
            <h2>Progress</h2>
            <div className="watch">
              <span className="spin" aria-hidden="true" />
              <span>
                {seen
                  ? `${coins(deal.receivedQty ?? deal.expectedQty)} ${deal.ticker} received on ${deal.network} · confirming…`
                  : `Watching the ${net.chain} network for your deposit…`}
              </span>
            </div>
            {seen && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    fontSize: 14.5,
                  }}
                >
                  <span>Confirmations</span>
                  <span className="num">
                    {Math.min(conf, deal.minConfirmations)} /{" "}
                    {deal.minConfirmations}
                  </span>
                </div>
                <div className="conf">
                  <i
                    style={{
                      width: `${Math.min(100, (conf / deal.minConfirmations) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
            <Timeline
              steps={[
                {
                  title: "Deal created",
                  sub: `Rate locked at ₦${formatRate(deal.rate)}`,
                  state: "done",
                },
                {
                  title: seen ? "Deposit seen" : "Waiting for deposit",
                  sub:
                    seen && explorer ? (
                      <>{explorer}</>
                    ) : (
                      `Send ${qty} on ${deal.network}`
                    ),
                  state: seen ? "done" : "now",
                },
                {
                  title: "Deposit complete",
                  sub: `After ${deal.minConfirmations} confirmations (about a minute)`,
                  state: seen ? "now" : "todo",
                },
                {
                  title: "Naira paid out",
                  sub: `About ${deal.payoutMinutes} minutes after deposit`,
                  state: "todo",
                },
              ]}
            />
            <p style={{ fontSize: 13.5, color: "var(--ink3)" }}>
              Keep this page open or come back any time with your deal link.
            </p>
            {message}
          </section>
        </aside>
      </div>
    </main>
  );
}
