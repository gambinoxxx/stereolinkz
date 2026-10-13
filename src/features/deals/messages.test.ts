import { describe, expect, it } from "vitest";

import {
  amountToPayText,
  dealAmountText,
  nairaText,
  rateText,
} from "@/features/deals/format";
import { continueMessage, teamMessages } from "@/features/deals/messages";

describe("format", () => {
  it("shows naira whole and amounts with their currency", () => {
    expect(nairaText("8282250.5")).toBe("₦8,282,251");
    expect(dealAmountText("SCHOOL_FEES", "4500.0000", "GBP")).toBe("4,500 GBP");
    expect(dealAmountText("POF", "15000000.0000", "NGN")).toBe("₦15,000,000");
    expect(rateText("SCHOOL_FEES", "1836.0000", "GBP")).toBe("₦1,836 per GBP");
    expect(rateText("POF", "3.4000", "NGN")).toBe("3.4% per month");
  });
  it("asks a forex seller for the foreign amount, everyone else for naira", () => {
    expect(amountToPayText("FOREX_SELL", "1000", "USD", "1350000")).toBe(
      "1,000 USD",
    );
    expect(amountToPayText("SCHOOL_FEES", "4500", "GBP", "8262000")).toBe(
      "₦8,262,000",
    );
    expect(amountToPayText("SCHOOL_FEES", "4500", "GBP", null)).toBeNull();
  });
});

describe("messages", () => {
  it("prefills the customer's hand-off with the reference, service and amount", () => {
    expect(
      continueMessage("Stereolinkz", {
        ref: "SLZ-1047",
        service: "SCHOOL_FEES",
        amount: "4500",
        currency: "GBP",
      }),
    ).toBe(
      "Hi Stereolinkz, my deal number is SLZ-1047 (school fees, 4,500 GBP).",
    );
  });

  const deal = {
    ref: "SLZ-1047",
    service: "SCHOOL_FEES" as const,
    amount: "4500",
    currency: "GBP",
    customerName: "Adaeze Okafor",
    agreedRate: "1836",
    agreedNaira: "8262000",
    account: {
      bank: "A Bank",
      accountNumber: "1306 482 951",
      accountName: "Stereolinkz Ltd",
    },
    trackUrl: null,
  };

  it("offers the payment details only while awaiting payment", () => {
    const awaiting = teamMessages({ ...deal, status: "AWAITING_PAYMENT" });
    expect(awaiting[0]).toEqual({
      label: "Send payment details",
      text: "Hi Adaeze, for SLZ-1047 please pay ₦8,262,000 to A Bank, 1306 482 951, Stereolinkz Ltd. Use SLZ-1047 as the narration. Only pay into the account on your deal page.",
    });
    for (const status of [
      "NEW",
      "AGREED",
      "PAYMENT_RECEIVED",
      "PROCESSING",
      "COMPLETED",
      "CANCELLED",
    ] as const)
      expect(
        teamMessages({ ...deal, status }).some((m) =>
          m.text.includes("1306 482 951"),
        ),
        status,
      ).toBe(false);
  });

  it("adds the deal link when the rep has it", () => {
    expect(
      teamMessages({
        ...deal,
        status: "NEW",
        trackUrl: "https://x/deal/SLZ-1047?t=abc",
      }).at(-1)?.label,
    ).toBe("Share the deal link");
  });
});
