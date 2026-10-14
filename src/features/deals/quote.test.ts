import { describe, expect, it } from "vitest";

import {
  agreedNairaFor,
  type QuoteBoards,
  quoteDeal,
} from "@/features/deals/quote";
import type { DealDetails } from "@/features/deals/schema";

const boards: QuoteBoards = {
  forex: {
    boardId: "fx-board",
    timeLabel: "10:25 AM",
    dateLabel: "Tue, 13 Oct 2026",
    rows: [
      { code: "AAA", buy: "1365.0000", sell: "1378.0000" },
      { code: "BBB", buy: "1815", sell: "1840.5" },
    ],
  },
  pof: {
    boardId: "pof-board",
    timeLabel: "9:00 AM",
    dateLabel: "Tue, 13 Oct 2026",
    rows: [
      { bankId: "bank-1", name: "Bank one", rate: "3.40" },
      { bankId: "bank-2", name: "Bank two", rate: "2.1" },
    ],
  },
};

const fees: DealDetails = {
  service: "SCHOOL_FEES",
  country: "United Kingdom",
  schoolName: "A school",
  studentName: "A student",
  purpose: "TUITION",
  invoiceRequired: true,
};
const pof = (bankId: string, months: number): DealDetails => ({
  service: "POF",
  bankId,
  months,
  neededBy: "2026-10-30",
  purpose: "STUDY_VISA",
  destinationCountry: "Canada",
});

describe("quoteDeal", () => {
  it("prices school fees, payments abroad and buying forex at our sell rate", () => {
    const q = quoteDeal(
      {
        service: "SCHOOL_FEES",
        currency: "BBB",
        amount: "4500",
        details: fees,
      },
      boards,
    );
    expect(q).toEqual({
      rate: "1840.5",
      naira: "8282250",
      boardId: "fx-board",
      timeLabel: "10:25 AM",
      dateLabel: "Tue, 13 Oct 2026",
      side: "sell",
    });
    expect(
      quoteDeal(
        {
          service: "INTL_PAYMENT",
          currency: "AAA",
          amount: "3200",
          details: {
            service: "INTL_PAYMENT",
            purpose: "SUPPLIER",
            country: "China",
            receiveMethod: "WIRE",
          },
        },
        boards,
      )?.naira,
    ).toBe("4409600");
    expect(
      quoteDeal(
        {
          service: "FOREX_BUY",
          currency: "AAA",
          amount: "2000",
          details: { service: "FOREX_BUY", method: "TRANSFER" },
        },
        boards,
      )?.naira,
    ).toBe("2756000");
  });

  it("prices selling forex at our buy rate", () => {
    const q = quoteDeal(
      {
        service: "FOREX_SELL",
        currency: "AAA",
        amount: "1000.50",
        details: { service: "FOREX_SELL", method: "TRANSFER" },
      },
      boards,
    );
    expect(q?.side).toBe("buy");
    expect(q?.rate).toBe("1365.0000");
    expect(q?.naira).toBe("1365682.5");
  });

  it("prices POF at amount × monthly rate ÷ 100 × months, exactly", () => {
    const q = quoteDeal(
      {
        service: "POF",
        currency: "NGN",
        amount: "15000000",
        details: pof("bank-1", 3),
      },
      boards,
    );
    expect(q).toEqual(
      expect.objectContaining({
        rate: "3.40",
        naira: "1530000",
        boardId: "pof-board",
        side: "pof",
        bankName: "Bank one",
      }),
    );
    // 1,234,567.89 × 2.1% × 5 = 129,629.62845
    expect(
      quoteDeal(
        {
          service: "POF",
          currency: "NGN",
          amount: "1234567.89",
          details: pof("bank-2", 5),
        },
        boards,
      )?.naira,
    ).toBe("129629.62845");
  });

  it("gives no quote when the currency or bank isn't on the latest board", () => {
    expect(
      quoteDeal(
        {
          service: "SCHOOL_FEES",
          currency: "ZZZ",
          amount: "100",
          details: fees,
        },
        boards,
      ),
    ).toBeNull();
    expect(
      quoteDeal(
        {
          service: "POF",
          currency: "NGN",
          amount: "100",
          details: pof("gone", 1),
        },
        boards,
      ),
    ).toBeNull();
  });

  it("gives no quote without a board", () => {
    expect(
      quoteDeal(
        {
          service: "SCHOOL_FEES",
          currency: "AAA",
          amount: "100",
          details: fees,
        },
        { forex: null, pof: null },
      ),
    ).toBeNull();
    expect(
      quoteDeal(
        {
          service: "POF",
          currency: "NGN",
          amount: "100",
          details: pof("bank-1", 1),
        },
        { forex: null, pof: null },
      ),
    ).toBeNull();
  });

  it("never quotes crypto in Phase 12", () => {
    expect(
      quoteDeal(
        {
          service: "CRYPTO_SELL",
          currency: "AAA",
          amount: "100",
          details: fees,
        },
        boards,
      ),
    ).toBeNull();
  });
});

describe("agreedNairaFor", () => {
  it("adds the fee to what the customer pays", () => {
    expect(agreedNairaFor("SCHOOL_FEES", "4500", "1836", "0")).toBe("8262000");
    expect(agreedNairaFor("INTL_PAYMENT", "3200", "1378.5", "2500")).toBe(
      "4413700",
    );
    expect(agreedNairaFor("FOREX_BUY", "100.50", "1378", "0")).toBe("138489");
  });
  it("takes the fee off what we pay a forex seller", () => {
    expect(agreedNairaFor("FOREX_SELL", "1000", "1360", "1000")).toBe(
      "1359000",
    );
  });
  it("works POF out per month", () => {
    expect(agreedNairaFor("POF", "15000000", "3.2", "0", 3)).toBe("1440000");
    expect(agreedNairaFor("POF", "15000000", "3.2", "5000", 3)).toBe("1445000");
  });
});
