// Forex rate input, shared by the drawers (client) and the actions
// (server). Rates stay strings end to end (Invariant 10); comparisons use
// compareDecimalStrings, never parseFloat or Number.
import { z } from "zod";

import { compareDecimalStrings } from "@/lib/decimal";

const DECIMAL = /^\d{1,10}(\.\d{1,4})?$/;

// What people type: "1,365", " 1365.50 ". Spaces and thousands commas are
// removed, then up to 10 integer digits (Decimal(14,4)) and 4 decimals.
export const normaliseDecimal = (value: string) =>
  value.trim().replace(/[\s,]/g, "");
export const isDecimal = (value: string) => DECIMAL.test(value);

export const decimalInput = z
  .string()
  .transform(normaliseDecimal)
  .pipe(
    z.string().regex(DECIMAL, "Enter a number with up to 4 decimal places."),
  );

export const RATE_ERRORS = {
  buyPositive: "Enter a buy rate above 0.",
  sellPositive: "Enter a sell rate above 0.",
  sellBelowBuy: "Sell must be the same as or higher than buy.",
} as const;

// buy > 0, sell > 0, sell ≥ buy. Shared with the add-currency form. Zod 4
// runs this even when a field already failed its format check, so values
// that aren't decimals are skipped (they have their own error).
export function checkRatePair(
  value: { buy: string; sell: string },
  ctx: z.RefinementCtx,
) {
  if (!DECIMAL.test(value.buy) || !DECIMAL.test(value.sell)) return;
  const buyOk = compareDecimalStrings(value.buy, "0") > 0;
  const sellOk = compareDecimalStrings(value.sell, "0") > 0;
  if (!buyOk)
    ctx.addIssue({
      code: "custom",
      path: ["buy"],
      message: RATE_ERRORS.buyPositive,
    });
  if (!sellOk)
    ctx.addIssue({
      code: "custom",
      path: ["sell"],
      message: RATE_ERRORS.sellPositive,
    });
  if (buyOk && sellOk && compareDecimalStrings(value.sell, value.buy) < 0)
    ctx.addIssue({
      code: "custom",
      path: ["sell"],
      message: RATE_ERRORS.sellBelowBuy,
    });
}

export const forexRateInput = z
  .object({
    currencyId: z.string().min(1),
    buy: decimalInput,
    sell: decimalInput,
  })
  .superRefine(checkRatePair);

export type ForexRateInput = z.infer<typeof forexRateInput>;
