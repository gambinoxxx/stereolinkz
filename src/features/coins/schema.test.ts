import { describe, expect, it } from "vitest";

import {
  coinInput,
  cryptoRateInput,
  networksInput,
  splitNetworks,
  tickerInput,
} from "@/features/coins/schema";

const valid = {
  ticker: " ton ",
  name: " Toncoin ",
  networks: "TON",
  iconUrl: null,
  active: true,
  buy: "1,540",
  sell: "1590",
};

const errorOf = (patch: Partial<typeof valid> | Record<string, unknown>) => {
  const parsed = coinInput.safeParse({ ...valid, ...patch });
  return parsed.success ? null : parsed.error.issues[0]?.message;
};

describe("tickerInput", () => {
  it("trims and uppercases; 2–6 letters or digits", () => {
    expect(tickerInput.parse(" ton ")).toBe("TON");
    expect(tickerInput.parse("usdt")).toBe("USDT");
    expect(tickerInput.parse("1inch".slice(0, 5))).toBe("1INCH");
    for (const bad of ["T", "TOOLONG", "US-D", "U SD", ""])
      expect(tickerInput.safeParse(bad).success, bad).toBe(false);
  });
});

describe("networks", () => {
  it("splits, trims, drops empties and dedupes ignoring case", () => {
    expect(splitNetworks("TRC20, bep20, , trc20 ,ERC20")).toEqual([
      "TRC20",
      "bep20",
      "ERC20",
    ]);
    expect(splitNetworks([" BEP20", "bep20", ""])).toEqual(["BEP20"]);
    expect(networksInput.parse("")).toEqual([]);
  });

  it("allows up to 4 networks of up to 8 characters", () => {
    expect(networksInput.parse("A, B, C, D")).toHaveLength(4);
    for (const bad of ["A, B, C, D, E", "NINECHARS"])
      expect(networksInput.safeParse(bad).error?.issues[0]?.message, bad).toBe(
        "Up to 4 networks, 8 characters each.",
      );
  });
});

describe("coinInput", () => {
  it("normalises a valid coin", () => {
    expect(coinInput.parse(valid)).toEqual({
      ticker: "TON",
      name: "Toncoin",
      networks: ["TON"],
      iconUrl: null,
      active: true,
      buy: "1540",
      sell: "1590",
    });
  });

  it("checks the name and the forex rate rules", () => {
    expect(errorOf({ name: "x".repeat(21) })).toBe(
      "Keep the name to 20 characters or fewer.",
    );
    expect(errorOf({ name: "  " })).toBe("Enter the name shown on boards.");
    expect(errorOf({ buy: "1600", sell: "1590" })).toBe(
      "Sell must be the same as or higher than buy.",
    );
    expect(errorOf({ buy: "0" })).toBe("Enter a buy rate above 0.");
  });
});

describe("cryptoRateInput", () => {
  it("uses the decimal input and the buy/sell refinement", () => {
    expect(
      cryptoRateInput.parse({ coinId: "c1", buy: "1,580", sell: "1620.50" }),
    ).toEqual({
      coinId: "c1",
      buy: "1580",
      sell: "1620.50",
    });
    expect(
      cryptoRateInput.safeParse({ coinId: "c1", buy: "1620", sell: "1580" })
        .success,
    ).toBe(false);
  });
});
