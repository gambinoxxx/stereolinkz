import { describe, expect, it } from "vitest";

import { currencyInput } from "@/features/currencies/schema";
import { RATE_ERRORS } from "@/features/forex-rates/schema";

const valid = {
  code: "cad",
  name: "Canadian dollar",
  symbol: "$",
  flagCode: "ca",
  active: true,
  buy: "985",
  sell: "1,002",
};

function errors(patch: Record<string, unknown>) {
  const result = currencyInput.safeParse({ ...valid, ...patch });
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((i) => [String(i.path[0]), i.message]),
      );
}

describe("currencyInput", () => {
  it("accepts a currency, uppercasing the code and normalising the rates", () => {
    expect(currencyInput.parse(valid)).toEqual({
      ...valid,
      code: "CAD",
      sell: "1002",
    });
  });

  it("needs a 3-letter code", () => {
    for (const code of ["CA", "CADX", "C4D", "", "$$$"]) {
      expect(errors({ code }).code, code).toBe(
        "Enter the 3-letter currency code.",
      );
    }
    expect(errors({ code: " usd " })).toEqual({});
  });

  it("needs a name of at most 40 characters", () => {
    expect(errors({ name: "  " }).name).toBe("Enter the name shown on boards.");
    expect(errors({ name: "A".repeat(41) }).name).toBe(
      "Keep the name to 40 characters or fewer.",
    );
  });

  it("allows an empty symbol, up to 4 characters", () => {
    expect(errors({ symbol: "" })).toEqual({});
    expect(errors({ symbol: "12345" }).symbol).toBe(
      "Keep the symbol to 4 characters or fewer.",
    );
  });

  it("takes a bundled flag code or no flag", () => {
    expect(errors({ flagCode: "" })).toEqual({});
    expect(errors({ flagCode: "zz" }).flagCode).toBe(
      "Pick a flag from the list, or No flag.",
    );
  });

  it("applies the rate rules", () => {
    expect(errors({ buy: "0" }).buy).toBe(RATE_ERRORS.buyPositive);
    expect(errors({ sell: "900" }).sell).toBe(RATE_ERRORS.sellBelowBuy);
    expect(errors({ sell: "985" })).toEqual({});
  });
});
