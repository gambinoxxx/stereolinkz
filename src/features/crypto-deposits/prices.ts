import "server-only";

// Live dollar prices for market-priced coins (Phase 13b), from CoinGecko's
// simple price endpoint (free; COINGECKO_API_KEY optional, sent as the
// demo-key header). Returns null when unavailable: the caller then waits
// and checks again, never guessing a price.
import {
  fetchJson,
  type HttpOptions,
} from "@/features/crypto-deposits/providers/http";
import { isDecimalString } from "@/lib/decimal";

const IDS: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum" };
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; price: string }>();

export async function usdPrice(
  ticker: string,
  { http, now = Date.now }: { http?: HttpOptions; now?: () => number } = {},
): Promise<string | null> {
  const id = IDS[ticker];
  if (!id) return null;
  const hit = cache.get(ticker);
  if (hit && now() - hit.at < TTL_MS) return hit.price;
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    const key = process.env.COINGECKO_API_KEY?.trim();
    if (key) headers["x-cg-demo-api-key"] = key;
    const body = await fetchJson<Record<string, { usd?: number }>>(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&precision=full`,
      { headers },
      { retries: 1, ...http },
    );
    const value = body[id]?.usd;
    if (typeof value !== "number" || !(value > 0)) return null;
    const price = value.toFixed(8).replace(/\.?0+$/, "");
    if (!isDecimalString(price)) return null;
    cache.set(ticker, { at: now(), price });
    return price;
  } catch {
    return null;
  }
}

export function clearPriceCache() {
  cache.clear();
}
