import { describe, expect, it } from "vitest";

import type {
  PublicCryptoRow,
  PublicForexRow,
  PublicLanding,
  PublicPofRow,
} from "@/features/public/landing-data";
import {
  buildLandingView,
  calculatorMessage,
  listJoin,
} from "@/features/public/landing-view";

const meta = {
  dateLabel: "Fri, 9 Oct 2026",
  timeLabel: "10:25 AM",
  createdAt: "2026-10-09T09:25:00.000Z",
  image: null,
};
const fx = (code: string, buy: string, sell: string): PublicForexRow => ({
  code,
  name: `${code} name`,
  flagCode: null,
  buy,
  sell,
});
const cx = (
  ticker: string,
  buy: string,
  networks: string[] = [],
): PublicCryptoRow => ({
  ticker,
  name: `${ticker} name`,
  networks,
  iconUrl: null,
  badgeColor: null,
  buy,
  sell: buy,
});
const pof = (name: string, rate: string): PublicPofRow => ({
  name,
  shortName: null,
  logoUrl: null,
  rate,
  note: null,
});

const full: PublicLanding = {
  org: null,
  forex: {
    ...meta,
    rows: [
      fx("AAA", "1365.0000", "1378.0000"),
      fx("BBB", "1815", "1840"),
      fx("CCC", "1560", "1583"),
    ],
  },
  crypto: {
    ...meta,
    rows: [
      cx("XT", "1590", ["TRC20", "BEP20"]),
      cx("YC", "1580"),
      cx("ZE", "1575"),
    ],
  },
  pof: { ...meta, rows: [pof("Bank one", "3.40"), pof("Bank two", "2.10")] },
};
const empty: PublicLanding = {
  org: null,
  forex: null,
  crypto: null,
  pof: null,
};

describe("listJoin", () => {
  it("joins with commas and a final and", () => {
    expect(listJoin([])).toBe("");
    expect(listJoin(["A"])).toBe("A");
    expect(listJoin(["A", "B"])).toBe("A and B");
    expect(listJoin(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("buildLandingView", () => {
  const view = buildLandingView(full);

  it("builds the rate ticker from the boards' buy rates", () => {
    expect(view.rateTicker).toEqual([
      { lead: "AAA", bold: "₦1,365", tail: "we buy" },
      { lead: "BBB", bold: "₦1,815", tail: "we buy" },
      { lead: "CCC", bold: "₦1,560", tail: "we buy" },
      { lead: "XT", bold: "₦1,590", tail: "per $1" },
      { lead: "YC", bold: "₦1,580", tail: "per $1" },
      { lead: "ZE", bold: "₦1,575", tail: "per $1" },
    ]);
  });

  it("adds the lowest POF rate to the service ticker", () => {
    expect(view.serviceTicker).toContainEqual({
      lead: "Proof of funds from",
      bold: "2.1%",
      tail: "per month",
    });
    expect(
      buildLandingView({ ...full, pof: null }).serviceTicker.map((t) => t.lead),
    ).not.toContain("Proof of funds from");
  });

  it("names currencies and coins from the boards", () => {
    expect(view.rotator.slice(0, 2)).toEqual([
      "sell AAA and BBB",
      "sell XT and YC",
    ]);
    expect(view.forexTitle).toBe("Sell AAA, BBB and CCC.");
    expect(view.cryptoTitle).toBe("Sell XT, YC and alt coins.");
    expect(view.forexFacts).toEqual([
      { label: "We buy AAA", value: "₦1,365" },
      { label: "We buy BBB", value: "₦1,815" },
    ]);
    expect(view.cryptoFacts).toEqual([
      { label: "XT · TRC20", value: "₦1,590" },
      { label: "YC per $1", value: "₦1,580" },
    ]);
    expect(view.pofFacts).toEqual([
      { label: "From", value: "2.1% / month" },
      { label: "Banks", value: "2 to choose from" },
    ]);
  });

  it("works examples out from today's board rates", () => {
    expect(view.fxExample).toEqual({
      code: "AAA",
      amount: "500",
      rate: "₦1,365",
      payout: "₦682,500",
    });
    expect(view.cxExample).toEqual({
      ticker: "XT",
      amount: "$1,200",
      payout: "₦1,908,000",
    });
    expect(view.feeExample).toEqual({
      amount: "4,500 BBB",
      rate: "₦1,840 per BBB",
      total: "₦8,280,000",
    });
  });

  it("offers every currency and coin in the calculator, coins in $ value", () => {
    expect(view.calcOptions.map((o) => o.label)).toEqual([
      "AAA",
      "BBB",
      "CCC",
      "XT ($ value)",
      "YC ($ value)",
      "ZE ($ value)",
    ]);
    expect(view.calcOptions[3]?.unit).toBe("per $1 of XT");
  });

  it("falls back to words, and no figures, without boards", () => {
    const none = buildLandingView(empty);
    expect(none.hasRates).toBe(false);
    expect(none.rateTicker).toEqual([]);
    expect(none.rotator.slice(0, 2)).toEqual([
      "sell foreign currency",
      "sell crypto",
    ]);
    expect(none.forexTitle).toBe("Sell your foreign currency.");
    expect(none.fxExample).toBeNull();
    expect(none.cxExample).toBeNull();
    expect(none.feeExample).toBeNull();
    expect(none.forexFacts).toEqual([]);
    expect(none.pofFacts).toEqual([]);
    expect(none.calcOptions).toEqual([]);
  });
});

describe("calculatorMessage", () => {
  const view = buildLandingView(full);
  const [usd, , , coin] = view.calcOptions;

  it("uses the buy rate when the customer sells", () => {
    expect(
      calculatorMessage({
        brand: "Stereolinkz",
        mode: "sell",
        amount: "500",
        option: usd!,
      }),
    ).toBe(
      "Hi Stereolinkz, I want to sell 500 AAA. Is ₦1,365 per AAA still today’s rate?",
    );
  });

  it("uses the sell rate when the customer buys", () => {
    expect(
      calculatorMessage({
        brand: "Stereolinkz",
        mode: "buy",
        amount: "200",
        option: usd!,
      }),
    ).toBe(
      "Hi Stereolinkz, I want to buy 200 AAA. Is ₦1,378 per AAA still today’s rate?",
    );
  });

  it("writes coin amounts in dollars", () => {
    expect(
      calculatorMessage({
        brand: "Stereolinkz",
        mode: "sell",
        amount: "50",
        option: coin!,
      }),
    ).toBe(
      "Hi Stereolinkz, I want to sell $50 of XT. Is ₦1,590 per $1 of XT still today’s rate?",
    );
  });
});
