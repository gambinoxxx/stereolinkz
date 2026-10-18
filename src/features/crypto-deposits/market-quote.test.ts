import { describe, expect, it } from "vitest";

import {
  dollarsForNaira,
  marketQuote,
} from "@/features/crypto-deposits/market-quote";

const terms = { marginPct: "1.5", minFeeUsd: "2", rate: "1330", decimals: 8 };

describe("marketQuote", () => {
  it("takes 1.5% when it is above the minimum", () => {
    expect(marketQuote({ ...terms, usd: "400", priceUsd: "81355" })).toEqual({
      quoteUsd: "400",
      feeUsd: "6.00",
      payoutUsd: "394.00",
      naira: "524020",
      coins: "0.00491672",
    });
  });

  it("takes the $2 minimum on small deals, rounding up to the cent", () => {
    expect(
      marketQuote({ ...terms, usd: "100", priceUsd: "81355" }),
    ).toMatchObject({
      feeUsd: "2.00",
      payoutUsd: "98.00",
    });
    expect(
      marketQuote({ ...terms, usd: "201", priceUsd: "81355" }),
    ).toMatchObject({
      feeUsd: "3.02", // 3.015 rounded up
      payoutUsd: "197.98",
    });
  });

  it("rounds the coins down, never up", () => {
    // 400 ÷ 81355.42 = 0.004916697…
    expect(
      marketQuote({ ...terms, usd: "400", priceUsd: "81355.42" })?.coins,
    ).toBe("0.00491669");
  });

  it("refuses what can't be quoted", () => {
    expect(
      marketQuote({ ...terms, usd: "400.5", priceUsd: "81355" }),
    ).toBeNull();
    expect(marketQuote({ ...terms, usd: "0", priceUsd: "81355" })).toBeNull();
    expect(marketQuote({ ...terms, usd: "2", priceUsd: "81355" })).toBeNull(); // all fee
    expect(marketQuote({ ...terms, usd: "400", priceUsd: "0" })).toBeNull();
  });
});

describe("dollarsForNaira", () => {
  it("finds the whole dollars whose payout covers the naira", () => {
    const usd = dollarsForNaira({ ...terms, naira: "524020" });
    expect(usd).toBe("400");
    const usd2 = dollarsForNaira({ ...terms, naira: "524021" });
    expect(usd2).toBe("401");
  });

  it("uses the minimum fee on small amounts", () => {
    // payout 98 → 98 + 2 = 100
    expect(dollarsForNaira({ ...terms, naira: String(98 * 1330) })).toBe("100");
  });
});
