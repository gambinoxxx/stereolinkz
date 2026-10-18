"use client";

import { ArrowRight, ArrowUpDown, Check, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  useId,
  useMemo,
  useState,
} from "react";

import { coinsForNaira } from "@/features/crypto-deposits/amounts";
import {
  dollarsForNaira,
  marketQuote,
} from "@/features/crypto-deposits/market-quote";
import { nameCheck } from "@/features/crypto-deposits/names";
import type { CryptoDesk } from "@/features/crypto-deposits/public-queries";
import { useMarketPrices } from "@/features/crypto-deposits/components/use-market-prices";
import { submitCryptoDealInput } from "@/features/crypto-deposits/schema";
import { useFormToken } from "@/features/deals/components/customer/use-form-token";
import { submitCryptoDeal } from "@/features/deals/public-actions";
import { amountString } from "@/features/deals/schema";
import { estimateNaira } from "@/features/public/estimate";
import { compareDecimalStrings, multiplyDecimalStrings } from "@/lib/decimal";
import { formatRate } from "@/lib/format";

const naira = (exact: string) =>
  `₦${formatRate(estimateNaira(exact, "1") ?? "0")}`;
const digits = (v: string) => v.replace(/[,\s]/g, "");

// deal-crypto.html. Figures here are for display; the server quotes again
// from the board it reads itself, and sets the exact amount to send.
export function CryptoForm({
  desk: cachedDesk,
  otherCoinsLink,
}: {
  desk: CryptoDesk; // from the cached page: market coins have no price yet
  otherCoinsLink: string;
}) {
  const id = useId();
  const router = useRouter();
  const getFormToken = useFormToken();
  const prices = useMarketPrices(
    cachedDesk.coins.some((c) => c.pricing === "MARKET"),
  );
  const desk = useMemo(
    () => ({
      ...cachedDesk,
      coins: cachedDesk.coins.map((c) =>
        c.pricing === "MARKET"
          ? { ...c, priceUsd: prices?.[c.ticker] ?? null }
          : c,
      ),
    }),
    [cachedDesk, prices],
  );
  const [v, setV] = useState({
    ticker: desk.coins[0]!.ticker,
    network: desk.coins[0]!.networks[0]!.network,
    qty: "",
    ngn: "",
    bank: "",
    accountNumber: "",
    accountName: "",
    name: "",
    whatsapp: "",
    email: "",
    consent: false,
    website: "",
  });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) =>
    setV((s) => ({ ...s, [key]: value }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const coin = desk.coins.find((c) => c.ticker === v.ticker) ?? desk.coins[0]!;
  const net =
    coin.networks.find((n) => n.network === v.network) ?? coin.networks[0]!;

  // BTC (MARKET): the customer sells whole dollars' worth; the fee comes
  // off the payout. Stablecoins: coins, 1:1 with dollars.
  const isMarket = (c: typeof coin) => c.pricing === "MARKET";
  const quoteFor = (qty: string, c: typeof coin) =>
    isMarket(c) && c.priceUsd && /^\d+$/.test(digits(qty))
      ? marketQuote({
          usd: digits(qty),
          priceUsd: c.priceUsd,
          marginPct: desk.marginPct,
          minFeeUsd: desk.minFeeUsd,
          rate: c.rate,
          decimals: c.decimals,
        })
      : null;

  // Linked boxes: typing the amount fills naira, typing naira fills it.
  const nairaFor = (qty: string, c: typeof coin) => {
    if (isMarket(c)) {
      const q = quoteFor(qty, c);
      return q ? formatRate(estimateNaira(q.naira, "1") ?? "0") : "";
    }
    const q = amountString.safeParse(qty);
    return q.success
      ? formatRate(
          estimateNaira(multiplyDecimalStrings(q.data, c.rate), "1") ?? "0",
        )
      : "";
  };
  function onQty(value: string) {
    setV((s) => ({ ...s, qty: value, ngn: nairaFor(value, coin) }));
  }
  function onNgn(value: string) {
    const n = digits(value);
    const valid = /^\d+(\.\d+)?$/.test(n);
    const q = !valid
      ? null
      : isMarket(coin)
        ? dollarsForNaira({
            naira: n,
            rate: coin.rate,
            marginPct: desk.marginPct,
            minFeeUsd: desk.minFeeUsd,
          })
        : coinsForNaira(n, coin.rate);
    setV((s) => ({
      ...s,
      ngn: value,
      qty: q && compareDecimalStrings(q, "0") > 0 ? q.replace(/\.00$/, "") : "",
    }));
  }
  function pickCoin(ticker: string) {
    const next = desk.coins.find((c) => c.ticker === ticker)!;
    setV((s) => ({
      ...s,
      ticker,
      network: next.networks.some((n) => n.network === s.network)
        ? s.network
        : next.networks[0]!.network,
      ngn: nairaFor(s.qty, next),
    }));
  }

  const market = isMarket(coin);
  const mq = quoteFor(v.qty, coin);
  const cleanQty = amountString.safeParse(v.qty);
  const total = market
    ? mq
      ? naira(mq.naira)
      : "₦0"
    : cleanQty.success
      ? naira(multiplyDecimalStrings(cleanQty.data, coin.rate))
      : "₦0";
  const shownQty = cleanQty.success ? formatRate(cleanQty.data) : "0";
  const unitLabel = (amount: string) =>
    market ? `$${amount}` : `${amount} ${coin.ticker}`;
  const check =
    v.name.trim() && v.accountName.trim()
      ? nameCheck(v.name, v.accountName)
      : null;

  const payload = {
    ticker: coin.ticker,
    network: net.network,
    qty: v.qty,
    payout: {
      bank: v.bank,
      accountNumber: v.accountNumber,
      accountName: v.accountName,
    },
    customer: { name: v.name, whatsapp: v.whatsapp, email: v.email },
    consent: v.consent,
    website: v.website,
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    const local: Record<string, string> = {};
    const parsed = submitCryptoDealInput.safeParse({
      ...payload,
      formToken: "",
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        local[issue.path.join(".")] ??= issue.message;
    if (
      cleanQty.success &&
      compareDecimalStrings(cleanQty.data, desk.minQty) < 0
    )
      local.qty = `The minimum is ${unitLabel(desk.minQty)}.`;
    if (
      cleanQty.success &&
      compareDecimalStrings(cleanQty.data, desk.maxUsd) > 0
    )
      local.qty = `For more than ${unitLabel(desk.maxUsd)}, message us on WhatsApp.`;
    if (market && cleanQty.success && !/^\d+$/.test(cleanQty.data))
      local.qty = "Enter whole dollars, like 400.";
    if (Object.keys(local).length) {
      setErrors(local);
      setFormError("Please check the highlighted fields.");
      return;
    }
    setErrors({});
    setPending(true);
    const result = await submitCryptoDeal({
      ...payload,
      formToken: await getFormToken(),
    });
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error);
      setPending(false);
      return;
    }
    router.push(
      `/deal/${result.data.ref}?t=${encodeURIComponent(result.data.token)}`,
    );
  }

  const fid = (name: string) => `${id}-${name}`;
  const errId = (key: string) => (errors[key] ? `${fid(key)}-err` : undefined);
  const inv = (k: string) => (errors[k] ? true : undefined);
  const fieldError = (k: string) =>
    errors[k] ? (
      <span className="ferr" id={`${fid(k)}-err`}>
        {errors[k]}
      </span>
    ) : null;

  const tickers = desk.coins.map((c) => c.ticker).join(" or ");
  return (
    <main className="page">
      <Link className="crumb" href="/deal/new">
        ← Start a deal
      </Link>
      <h1>Sell crypto</h1>
      <p className="lead">
        Send {tickers} and get naira in your bank account, usually within{" "}
        {desk.payoutMinutes} minutes of your deposit confirming.
      </p>
      <form className="grid" onSubmit={onSubmit} noValidate id={fid("form")}>
        <div>
          <section className="card">
            <h2>
              <span className="n">1</span>What are you sending?
            </h2>
            <div className="fields">
              <fieldset className="coins">
                <legend className="sr-only">Coin</legend>
                {desk.coins.map((c) => (
                  <label key={c.ticker}>
                    <input
                      type="radio"
                      name={fid("coin")}
                      checked={c.ticker === coin.ticker}
                      onChange={() => pickCoin(c.ticker)}
                    />
                    <span>
                      <i
                        className="cb"
                        style={
                          c.badgeColor
                            ? ({ "--coin": c.badgeColor } as CSSProperties)
                            : undefined
                        }
                        aria-hidden="true"
                      >
                        {c.iconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.iconUrl} alt="" />
                        ) : (
                          c.ticker[0]
                        )}
                      </i>
                      <span>
                        <b>{c.ticker}</b>
                        <small>₦{formatRate(c.rate)} per $1</small>
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="fld">
                <legend className="lbl" style={{ marginBottom: 7 }}>
                  Network
                </legend>
                <div className="pills">
                  {coin.networks.map((n) => (
                    <label className="pill" key={n.network}>
                      <input
                        type="radio"
                        name={fid("net")}
                        checked={n.network === net.network}
                        onChange={() => set("network", n.network)}
                      />
                      <span>{n.label}</span>
                    </label>
                  ))}
                </div>
                <span className="hint">
                  You must send on this network. Coins sent on another network
                  can be lost.
                </span>
              </fieldset>
              <div className="flip">
                <div className="fld">
                  <label htmlFor={fid("qty")}>
                    {market ? `You sell (${coin.ticker} worth)` : "You send"}
                  </label>
                  <div className="money" data-invalid={inv("qty")}>
                    {market && <span className="unit">$</span>}
                    <input
                      id={fid("qty")}
                      inputMode={market ? "numeric" : "decimal"}
                      autoComplete="off"
                      placeholder="0"
                      value={v.qty}
                      aria-invalid={inv("qty")}
                      aria-describedby={errId("qty")}
                      onChange={(e) => onQty(e.target.value)}
                    />
                    {!market && <span className="unit">{coin.ticker}</span>}
                  </div>
                </div>
                <span className="flipbtn" aria-hidden="true">
                  <ArrowUpDown size={18} strokeWidth={2.4} />
                </span>
                <div className="fld">
                  <label htmlFor={fid("ngn")}>You receive</label>
                  <div className="money">
                    <span className="unit">₦</span>
                    <input
                      id={fid("ngn")}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      value={v.ngn || nairaFor(v.qty, coin)}
                      onChange={(e) => onNgn(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              {fieldError("qty")}
              {market && !coin.priceUsd && (
                <div className={`note${prices ? " warn" : ""}`} role="status">
                  {prices ? (
                    <Info
                      size={18}
                      strokeWidth={2.2}
                      aria-hidden="true"
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                  ) : (
                    <Loader2
                      size={18}
                      strokeWidth={2.2}
                      aria-hidden="true"
                      className="animate-spin"
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                  )}
                  <span>
                    {prices
                      ? `We can’t get the live ${coin.ticker} price right now. Try again in a minute, or ask us on WhatsApp.`
                      : `Getting the live ${coin.ticker} price…`}
                  </span>
                </div>
              )}
              {market && coin.priceUsd && (
                <div className="note ok">
                  <Info
                    size={18}
                    strokeWidth={2.2}
                    aria-hidden="true"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <span>
                    {mq ? (
                      <>
                        You’ll send about{" "}
                        <b>
                          {mq.coins} {coin.ticker}
                        </b>{" "}
                        at $
                        {formatRate(
                          coin.priceUsd.replace(/(\.\d{2})\d+$/, "$1"),
                        )}{" "}
                        per {coin.ticker}. The exact amount is on the next
                        page.{" "}
                      </>
                    ) : null}
                    Conversion fee: {mq ? <b>${mq.feeUsd}</b> : null} (
                    {formatRate(desk.marginPct)}%, at least $
                    {formatRate(desk.minFeeUsd)}). It covers price changes and
                    network fees.
                  </span>
                </div>
              )}
              <p
                className="hint"
                style={{ fontSize: 13.5, color: "var(--ink3)" }}
              >
                Type in either box. Minimum {unitLabel(desk.minQty)}. Other
                coins:{" "}
                <a
                  href={otherCoinsLink}
                  target="_blank"
                  rel="noopener"
                  style={{ color: "var(--violet)", fontWeight: 750 }}
                >
                  ask us on WhatsApp
                </a>
                .
                {desk.ethCheck && (
                  <>
                    {" "}
                    Sold ETH on WhatsApp?{" "}
                    <Link
                      href="/deal/check-eth"
                      style={{ color: "var(--violet)", fontWeight: 750 }}
                    >
                      Check your transfer
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="n">2</span>Where should we pay you?
            </h2>
            <div className="fields">
              <div className="row2">
                <div className="fld">
                  <label htmlFor={fid("payout.bank")}>Bank</label>
                  <input
                    className="inp"
                    id={fid("payout.bank")}
                    autoComplete="off"
                    value={v.bank}
                    aria-invalid={inv("payout.bank")}
                    aria-describedby={errId("payout.bank")}
                    onChange={(e) => set("bank", e.target.value)}
                  />
                  {fieldError("payout.bank")}
                </div>
                <div className="fld">
                  <label htmlFor={fid("payout.accountNumber")}>
                    Account number
                  </label>
                  <input
                    className="inp"
                    id={fid("payout.accountNumber")}
                    inputMode="numeric"
                    maxLength={13}
                    placeholder="10 digits"
                    value={v.accountNumber}
                    aria-invalid={inv("payout.accountNumber")}
                    aria-describedby={errId("payout.accountNumber")}
                    onChange={(e) => set("accountNumber", e.target.value)}
                  />
                  {fieldError("payout.accountNumber")}
                </div>
              </div>
              <div className="fld">
                <label htmlFor={fid("payout.accountName")}>
                  Name on the account
                </label>
                <input
                  className="inp"
                  id={fid("payout.accountName")}
                  autoComplete="off"
                  placeholder="As your bank shows it"
                  value={v.accountName}
                  aria-invalid={inv("payout.accountName")}
                  aria-describedby={errId("payout.accountName")}
                  onChange={(e) => set("accountName", e.target.value)}
                />
                {fieldError("payout.accountName")}
              </div>
              {check === "MATCH" ? (
                <div className="note ok">
                  <Check size={16} strokeWidth={3} aria-hidden="true" />
                  <span>
                    <b>{v.accountName.trim()}</b> · matches your name. Payouts
                    go only to an account in your own name.
                  </span>
                </div>
              ) : check ? (
                <div className="note warn">
                  <Info
                    size={18}
                    strokeWidth={2.2}
                    aria-hidden="true"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <span>
                    This name doesn’t match yours. Payouts go only to an account
                    in your own name, so our team will check it with you on
                    WhatsApp first.
                  </span>
                </div>
              ) : (
                <span className="hint">
                  Payouts go only to an account in your own name.
                </span>
              )}
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="n">3</span>Your details
            </h2>
            <p className="d">
              So our team can confirm the deal with you on WhatsApp.
            </p>
            <div className="fields">
              <div className="fld">
                <label htmlFor={fid("customer.name")}>Full name</label>
                <input
                  className="inp"
                  id={fid("customer.name")}
                  autoComplete="name"
                  placeholder="As it appears on your bank account"
                  value={v.name}
                  aria-invalid={inv("customer.name")}
                  aria-describedby={errId("customer.name")}
                  onChange={(e) => set("name", e.target.value)}
                />
                {fieldError("customer.name")}
              </div>
              <div className="row2">
                <div className="fld">
                  <label htmlFor={fid("customer.whatsapp")}>
                    WhatsApp number
                  </label>
                  <input
                    className="inp"
                    id={fid("customer.whatsapp")}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0803 123 4567"
                    value={v.whatsapp}
                    aria-invalid={inv("customer.whatsapp")}
                    aria-describedby={errId("customer.whatsapp")}
                    onChange={(e) => set("whatsapp", e.target.value)}
                  />
                  {fieldError("customer.whatsapp")}
                </div>
                <div className="fld">
                  <label htmlFor={fid("customer.email")}>
                    Email{" "}
                    <span style={{ color: "var(--ink3)", fontWeight: 500 }}>
                      (optional)
                    </span>
                  </label>
                  <input
                    className="inp"
                    id={fid("customer.email")}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={v.email}
                    aria-invalid={inv("customer.email")}
                    aria-describedby={errId("customer.email")}
                    onChange={(e) => set("email", e.target.value)}
                  />
                  {fieldError("customer.email")}
                </div>
              </div>
              <div className="hp" aria-hidden="true">
                <label htmlFor={fid("website")}>Website</label>
                <input
                  id={fid("website")}
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={v.website}
                  onChange={(e) => set("website", e.target.value)}
                />
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={v.consent}
                  aria-invalid={inv("consent")}
                  aria-describedby={errId("consent")}
                  onChange={(e) => set("consent", e.target.checked)}
                />
                <span>
                  I agree that my details are used only for this deal, and
                  shared with our team to arrange it.
                </span>
              </label>
              {fieldError("consent")}
            </div>
          </section>
          {formError && (
            <p className="note bad formerr" role="alert">
              {formError}
            </p>
          )}
        </div>

        <aside className="sum hide-m" aria-label="Estimate">
          <div className="k">You receive</div>
          <div className="big num" aria-live="polite">
            {total}
          </div>
          <div className="sub">
            {market
              ? `for $${mq?.quoteUsd ?? "0"} of ${coin.ticker} (fee $${mq?.feeUsd ?? "0"})`
              : `for ${shownQty} ${coin.ticker} on ${net.network}`}
          </div>
          <div className="lines">
            <div className="ln">
              <span>Rate</span>
              <span className="num">₦{formatRate(coin.rate)} per $1</span>
            </div>
            {market && (
              <div className="ln">
                <span>Conversion fee</span>
                <span className="num">
                  {mq ? `$${mq.feeUsd} · ` : ""}
                  {formatRate(desk.marginPct)}%, min $
                  {formatRate(desk.minFeeUsd)}
                </span>
              </div>
            )}
            <div className="ln">
              <span>Rate locked for</span>
              <span className="num">
                {desk.lockMinutes} minutes after you continue
              </span>
            </div>
            <div className="ln">
              <span>Payout</span>
              <span className="num">
                About {desk.payoutMinutes} min after confirmation
              </span>
            </div>
          </div>
          <button className="btn gold block" type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2
                  size={18}
                  className="animate-spin"
                  aria-hidden="true"
                />
                Sending…
              </>
            ) : (
              <>
                Continue to deposit{" "}
                <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
              </>
            )}
          </button>
          <p className="fine">
            Your rate is locked for {desk.lockMinutes} minutes once you
            continue. Deposits after that are re-quoted at the current rate.
            Rates from our latest board ({desk.timeLabel}).
          </p>
        </aside>
      </form>
      <div className="mbar">
        <div className="t">
          <small>You receive</small>
          <b className="num">{total}</b>
        </div>
        <button
          className="btn gold"
          type="submit"
          form={fid("form")}
          disabled={pending}
        >
          {pending ? "Sending…" : "Continue"}
        </button>
      </div>
    </main>
  );
}
