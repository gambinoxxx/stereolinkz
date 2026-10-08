// Everything on the landing page that names a currency, coin or bank, or
// shows a figure, is built here from the latest boards (Invariant 1: no
// names in code; no invented figures). Worked examples ("Sell 500 X") are
// today's board rate × a round amount, labelled as examples. Pure, tested.
import { compareDecimalStrings } from "@/lib/decimal";
import { formatBoardPrice, formatRate } from "@/lib/format";

import { content } from "@/features/public/content";
import { estimateNaira } from "@/features/public/estimate";
import type { PublicLanding } from "@/features/public/landing-data";

export const naira = (value: string) => `₦${formatRate(value)}`;

// "A, B and C"
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export type TickerItem = { lead: string; bold: string; tail?: string };

export type CalcOption = {
  key: string; // "fx:USD" / "cx:BTC"
  code: string;
  label: string; // option text: "USD", "BTC ($ value)"
  buy: string;
  sell: string;
  unit: string; // "per USD", "per $1 of BTC"
  coin: boolean;
};

export type ServiceFact = { label: string; value: string };

export type LandingView = ReturnType<typeof buildLandingView>;

const EXAMPLE_FOREX_AMOUNT = "500";
const EXAMPLE_CRYPTO_AMOUNT = "1200";

export function buildLandingView(data: PublicLanding) {
  const fx = data.forex?.rows ?? [];
  const cx = data.crypto?.rows ?? [];
  const pof = data.pof?.rows ?? [];
  const fx0 = fx[0];
  const cx0 = cx[0];

  // ── Tickers ──────────────────────────────────────────────────────────
  const rateTicker: TickerItem[] = [
    ...fx.map((r) => ({ lead: r.code, bold: naira(r.buy), tail: "we buy" })),
    ...cx.map((r) => ({ lead: r.ticker, bold: naira(r.buy), tail: "per $1" })),
  ];
  const pofMin = pof.reduce<string | null>(
    (min, r) =>
      min === null || compareDecimalStrings(r.rate, min) < 0 ? r.rate : min,
    null,
  );
  const serviceTicker: TickerItem[] = [
    content.tickerServices[0]!,
    ...(pofMin
      ? [
          {
            lead: "Proof of funds from",
            bold: `${formatBoardPrice(pofMin)}%`,
            tail: "per month",
          },
        ]
      : []),
    ...content.tickerServices.slice(1),
  ];

  // ── Hero rotator ─────────────────────────────────────────────────────
  const rotator = [
    fx.length
      ? `sell ${listJoin(fx.slice(0, 2).map((r) => r.code))}`
      : content.hero.rotatorForexFallback,
    cx.length
      ? `sell ${listJoin(cx.slice(0, 2).map((r) => r.ticker))}`
      : content.hero.rotatorCryptoFallback,
    ...content.hero.rotatorRest,
  ];

  // ── Worked examples ──────────────────────────────────────────────────
  const fxExample = fx0
    ? {
        code: fx0.code,
        amount: EXAMPLE_FOREX_AMOUNT,
        rate: naira(fx0.buy),
        payout: naira(estimateNaira(EXAMPLE_FOREX_AMOUNT, fx0.buy) ?? "0"),
      }
    : null;
  const cxExample = cx0
    ? {
        ticker: cx0.ticker,
        amount: `$${formatRate(EXAMPLE_CRYPTO_AMOUNT)}`,
        payout: naira(estimateNaira(EXAMPLE_CRYPTO_AMOUNT, cx0.buy) ?? "0"),
      }
    : null;
  // The school-fees example pays in the second currency on the board (the
  // first is usually the one customers sell), at our sell rate.
  const feeRow = fx[1] ?? fx0;
  const feeExample = feeRow
    ? {
        amount: `${formatRate(content.fees.example.amount)} ${feeRow.code}`,
        rate: `${naira(feeRow.sell)} per ${feeRow.code}`,
        total: naira(
          estimateNaira(content.fees.example.amount, feeRow.sell) ?? "0",
        ),
      }
    : null;

  // ── Services (pinned section) ────────────────────────────────────────
  const forexTitle = fx.length
    ? `Sell ${listJoin(fx.slice(0, 3).map((r) => r.code))}.`
    : content.services.forex.fallbackTitle;
  const cryptoTitle = cx.length
    ? cx.length > 2
      ? `Sell ${cx[0]!.ticker}, ${cx[1]!.ticker} and alt coins.`
      : `Sell ${listJoin(cx.map((r) => r.ticker))}.`
    : content.services.crypto.fallbackTitle;
  const forexFacts: ServiceFact[] = fx
    .slice(0, 2)
    .map((r) => ({ label: `We buy ${r.code}`, value: naira(r.buy) }));
  const cryptoFacts: ServiceFact[] = cx.slice(0, 2).map((r) => ({
    label: r.networks[0]
      ? `${r.ticker} · ${r.networks[0]}`
      : `${r.ticker} per $1`,
    value: naira(r.buy),
  }));
  const pofFacts: ServiceFact[] = pofMin
    ? [
        { label: "From", value: `${formatBoardPrice(pofMin)}% / month` },
        {
          label: "Banks",
          value: `${pof.length} to choose from`,
        },
      ]
    : [];

  // ── Calculator ───────────────────────────────────────────────────────
  const calcOptions: CalcOption[] = [
    ...fx.map((r) => ({
      key: `fx:${r.code}`,
      code: r.code,
      label: r.code,
      buy: r.buy,
      sell: r.sell,
      unit: `per ${r.code}`,
      coin: false,
    })),
    // Coin rates are naira per $1 of coin value, so amounts are in dollars.
    ...cx.map((r) => ({
      key: `cx:${r.ticker}`,
      code: r.ticker,
      label: `${r.ticker} ($ value)`,
      buy: r.buy,
      sell: r.sell,
      unit: `per $1 of ${r.ticker}`,
      coin: true,
    })),
  ];

  return {
    rateTicker,
    serviceTicker,
    rotator,
    fxExample,
    cxExample,
    feeExample,
    forexTitle,
    cryptoTitle,
    forexFacts,
    cryptoFacts,
    pofFacts,
    calcOptions,
    hasRates: fx.length + cx.length + pof.length > 0,
  };
}

// The calculator's WhatsApp message.
// "Hi Stereolinkz, I want to sell 500 USD. Is ₦1,365 per USD still today’s rate?"
export function calculatorMessage({
  brand,
  mode,
  amount,
  option,
}: {
  brand: string;
  mode: "sell" | "buy";
  amount: string;
  option: CalcOption;
}): string {
  const rate = mode === "sell" ? option.buy : option.sell;
  const cleaned = amount.trim();
  const what = option.coin
    ? `${cleaned ? `$${cleaned} of ` : ""}${option.code}`
    : `${cleaned ? `${cleaned} ` : ""}${option.code}`;
  return `Hi ${brand}, I want to ${mode} ${what}. Is ${naira(rate)} ${option.unit} still today’s rate?`;
}
