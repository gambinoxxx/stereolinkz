// The deal estimate (Deal.quotedRate / quotedNaira), from the latest
// generated board of the matching type. Pure and client-safe: the form
// shows it for display, and the server recomputes it on submit from the
// snapshot it reads itself (it never trusts a client figure).
//   SCHOOL_FEES, INTL_PAYMENT, FOREX_BUY: amount × our SELL rate (Forex board)
//   FOREX_SELL: amount × our BUY rate (Forex board)
//   POF: amount × the bank's monthly rate ÷ 100 × months (POF board)
// A currency or bank missing from the board gives no quote: the page says
// "We’ll quote on WhatsApp". Values are exact decimal strings.
import type { DealDetails } from "@/features/deals/schema";
import type { DealService } from "@/generated/prisma/enums";
import { multiplyDecimalStrings, subtractDecimalStrings } from "@/lib/decimal";

export type QuoteForexRow = { code: string; buy: string; sell: string };
export type QuotePofRow = { bankId: string; name: string; rate: string };

type BoardMeta = { boardId: string; timeLabel: string; dateLabel: string };
export type QuoteBoards = {
  forex: (BoardMeta & { rows: QuoteForexRow[] }) | null;
  pof: (BoardMeta & { rows: QuotePofRow[] }) | null;
};

export type Quote = {
  rate: string; // naira per unit; POF: percent per month
  naira: string; // exact: the customer pays (or, selling forex, receives) this
  boardId: string;
  timeLabel: string; // "10:25 AM", for "Estimate from today’s rates (updated …)"
  dateLabel: string;
  side: "buy" | "sell" | "pof";
  bankName?: string; // POF
};

export type QuoteRequest = {
  service: DealService;
  currency: string;
  amount: string; // a plain positive decimal string
  details: DealDetails;
};

export function quoteDeal(
  req: QuoteRequest,
  boards: QuoteBoards,
): Quote | null {
  switch (req.service) {
    case "SCHOOL_FEES":
    case "INTL_PAYMENT":
    case "FOREX_BUY":
      return forexQuote(req, boards, "sell");
    case "FOREX_SELL":
      return forexQuote(req, boards, "buy");
    case "POF":
      return pofQuote(req, boards);
    case "CRYPTO_SELL":
      return null; // Phase 13
  }
}

function forexQuote(
  req: QuoteRequest,
  { forex }: QuoteBoards,
  side: "buy" | "sell",
): Quote | null {
  const row = forex?.rows.find((r) => r.code === req.currency);
  if (!forex || !row) return null;
  const rate = row[side];
  return {
    rate,
    naira: multiplyDecimalStrings(req.amount, rate),
    boardId: forex.boardId,
    timeLabel: forex.timeLabel,
    dateLabel: forex.dateLabel,
    side,
  };
}

function pofQuote(req: QuoteRequest, { pof }: QuoteBoards): Quote | null {
  if (req.details.service !== "POF" || req.currency !== "NGN") return null;
  const { bankId, months } = req.details;
  const row = pof?.rows.find((r) => r.bankId === bankId);
  if (!pof || !row) return null;
  // amount × rate% × months = amount × rate × months × 0.01
  const naira = multiplyDecimalStrings(
    multiplyDecimalStrings(
      multiplyDecimalStrings(req.amount, row.rate),
      String(months),
    ),
    "0.01",
  );
  return {
    rate: row.rate,
    naira,
    boardId: pof.boardId,
    timeLabel: pof.timeLabel,
    dateLabel: pof.dateLabel,
    side: "pof",
    bankName: row.name,
  };
}

// The agreed total, from the rate and fee the team agreed on WhatsApp.
// The customer pays amount × rate + fee; selling forex, we pay them
// amount × rate − fee; POF is amount × rate% × months + fee. Exact strings.
export function agreedNairaFor(
  service: DealService,
  amount: string,
  rate: string,
  fee: string,
  months = 1,
): string {
  const base =
    service === "POF"
      ? multiplyDecimalStrings(
          multiplyDecimalStrings(
            multiplyDecimalStrings(amount, rate),
            String(months),
          ),
          "0.01",
        )
      : multiplyDecimalStrings(amount, rate);
  return service === "FOREX_SELL"
    ? subtractDecimalStrings(base, fee)
    : addDecimalStrings(base, fee);
}

function addDecimalStrings(a: string, b: string): string {
  return subtractDecimalStrings(a, b.startsWith("-") ? b.slice(1) : `-${b}`);
}
