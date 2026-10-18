// The quote for a market-priced coin (BTC, Phase 13b). Pure and
// client-safe: the form shows it, the server works it out again with a
// fresh price. Exact decimals throughout (scaled BigInt), no floats.
//   fee     = max(dollars × margin %, minimum fee), rounded up to cents
//   payout  = dollars − fee            (what the naira is worked out on)
//   naira   = payout × board rate      (₦ per $1)
//   coins   = dollars ÷ price, rounded down to the coin's decimals
//             (the deposit page adds a few unique satoshis on top)
import { multiplyDecimalStrings, toDecimalString } from "@/lib/decimal";

export type MarketQuote = {
  quoteUsd: string; // whole dollars
  feeUsd: string; // 2 decimals
  payoutUsd: string; // 2 decimals
  naira: string; // exact
  coins: string; // e.g. "0.00491237"
};

const TEN = BigInt(10);
const scale = (n: number) => TEN ** BigInt(n);

// "81355.42" → 8135542n at 2 decimals (more decimals are cut, not rounded).
function toScaled(value: string, decimals: number): bigint {
  const [int = "0", frac = ""] = toDecimalString(value).split(".");
  return (
    BigInt(int) * scale(decimals) +
    BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0")
  );
}
function fromScaled(value: bigint, decimals: number): string {
  const s = value.toString().padStart(decimals + 1, "0");
  return decimals ? `${s.slice(0, -decimals)}.${s.slice(-decimals)}` : s;
}

export function marketQuote({
  usd,
  priceUsd,
  marginPct,
  minFeeUsd,
  rate,
  decimals,
}: {
  usd: string; // whole dollars, e.g. "400"
  priceUsd: string; // dollars per coin
  marginPct: string; // "1.5"
  minFeeUsd: string; // "2"
  rate: string; // ₦ per $1 from the board
  decimals: number; // 8 for BTC
}): MarketQuote | null {
  if (!/^\d+$/.test(usd)) return null;
  const dollars = BigInt(usd);
  const price = toScaled(priceUsd, 8);
  if (dollars <= BigInt(0) || price <= BigInt(0)) return null;

  const usdCents = dollars * BigInt(100);
  // cents × pct (2 decimals) ÷ 100 ÷ 100, rounded up to the cent
  const pct = toScaled(marginPct, 2);
  const pctFee = (usdCents * pct + BigInt(9999)) / BigInt(10000);
  const minFee = toScaled(minFeeUsd, 2);
  const fee = pctFee > minFee ? pctFee : minFee;
  const payout = usdCents - fee;
  if (payout <= BigInt(0)) return null;

  // coins = dollars ÷ price, at `decimals`: (cents × 10^decimals × 10^6) ÷ price(×10^8)
  const units = (usdCents * scale(decimals) * scale(6)) / price;

  const payoutUsd = fromScaled(payout, 2);
  return {
    quoteUsd: usd,
    feeUsd: fromScaled(fee, 2),
    payoutUsd,
    naira: multiplyDecimalStrings(payoutUsd, rate),
    coins: fromScaled(units, decimals),
  };
}

// The linked "You receive ₦" box: the whole dollars to sell so the payout
// covers the naira typed (rounded up to the next dollar).
export function dollarsForNaira({
  naira,
  rate,
  marginPct,
  minFeeUsd,
}: {
  naira: string;
  rate: string;
  marginPct: string;
  minFeeUsd: string;
}): string | null {
  const n = toScaled(naira, 2);
  const r = toScaled(rate, 4);
  if (n <= BigInt(0) || r <= BigInt(0)) return null;
  // payout cents = ceil(naira ÷ rate × 100)
  const payout = (n * scale(4) + r - BigInt(1)) / r;
  const pct = toScaled(marginPct, 2); // e.g. 150 = 1.50%
  // dollars with a % fee: payout ÷ (1 − pct), rounded up to whole dollars
  const byPct =
    (payout * BigInt(10000) + (BigInt(10000) - pct) * BigInt(100) - BigInt(1)) /
    ((BigInt(10000) - pct) * BigInt(100));
  const byMin = (payout + toScaled(minFeeUsd, 2) + BigInt(99)) / BigInt(100);
  const pick = (d: bigint) => {
    const q = marketQuote({
      usd: d.toString(),
      priceUsd: "1",
      marginPct,
      minFeeUsd,
      rate,
      decimals: 0,
    });
    return q && toScaled(q.payoutUsd, 2) >= payout;
  };
  for (const d of [
    byPct < byMin ? byPct : byMin,
    byPct > byMin ? byPct : byMin,
    byPct + BigInt(1),
    byMin + BigInt(1),
  ])
    if (d > BigInt(0) && pick(d)) return d.toString();
  return null;
}
