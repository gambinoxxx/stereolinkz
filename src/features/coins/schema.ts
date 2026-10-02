// Coin and crypto rate input, shared by the drawers (client) and the
// actions (server). code-standards.md → Data and Storage → Validation
// rules. Rates are naira per $1 of coin value, with the forex rules.
import { z } from "zod";

import { checkRatePair, decimalInput } from "@/features/forex-rates/schema";

export const TICKER_PATTERN = /^[A-Z0-9]{2,6}$/;
export const COIN_NAME_MAX = 20;
export const NETWORKS_MAX = 4;
export const NETWORK_MAX = 8;
export const NETWORKS_ERROR = `Up to ${NETWORKS_MAX} networks, ${NETWORK_MAX} characters each.`;

// " ton " → "TON". 2–6 capital letters or digits.
export const tickerInput = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        TICKER_PATTERN,
        "Enter a ticker of 2 to 6 letters or digits, like TON.",
      ),
  );

export const coinNameInput = z
  .string()
  .trim()
  .min(1, "Enter the name shown on boards.")
  .max(COIN_NAME_MAX, `Keep the name to ${COIN_NAME_MAX} characters or fewer.`);

// "TRC20, bep20, , trc20" or ["TRC20", "bep20"] → ["TRC20", "bep20"]:
// trimmed, empties dropped, deduplicated ignoring case (first spelling
// kept). Display text only; boards show the first 2.
export function splitNetworks(raw: string | readonly string[]): string[] {
  const parts = typeof raw === "string" ? raw.split(",") : raw;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const network = part.trim();
    const key = network.toLowerCase();
    if (network === "" || seen.has(key)) continue;
    seen.add(key);
    result.push(network);
  }
  return result;
}

export const networksInput = z
  .union([z.string(), z.array(z.string())])
  .transform((raw) => splitNetworks(raw))
  .pipe(
    z
      .array(z.string().max(NETWORK_MAX, NETWORKS_ERROR))
      .max(NETWORKS_MAX, NETWORKS_ERROR),
  );

export const cryptoRateInput = z
  .object({
    coinId: z.string().min(1),
    buy: decimalInput,
    sell: decimalInput,
  })
  .superRefine(checkRatePair);

export const coinDetailsInput = z.object({
  coinId: z.string().min(1),
  networks: networksInput,
});

// Add coin: the Coin and its first rate. The icon is uploaded separately
// (uploadCoinIcon) and passed as its URL.
export const coinInput = z
  .object({
    ticker: tickerInput,
    name: coinNameInput,
    networks: networksInput,
    iconUrl: z.string().url().nullable(),
    active: z.boolean(),
    buy: decimalInput,
    sell: decimalInput,
  })
  .superRefine(checkRatePair);

export type CoinFormInput = z.input<typeof coinInput>;
export type CoinValues = z.output<typeof coinInput>;
