import { describe, expect, it } from "vitest";

import {
  customerPaidPayload,
  dealCancelledPayload,
  depositCompletePayload,
  newDealPayload,
  payoutOverduePayload,
  TEST_PAYLOAD,
  whatsappHandoverPayload,
} from "@/features/notifications/events";

// A whole deal row, personal data included, as a careless caller might
// pass it. None of it may reach a lock screen.
const PRIVATE = {
  customerName: "Adaeze Okafor",
  customerWhatsapp: "+234 803 555 0199",
  customerEmail: "adaeze@example.com",
  payoutAccountNumber: "0123456789",
  payoutAccountName: "Adaeze Okafor",
  payoutBank: "GTBank",
};
const deal = {
  ...PRIVATE,
  ref: "SLZ-1094",
  service: "SCHOOL_FEES" as const,
  amount: "9500",
  currency: "GBP",
};
const NOW = new Date("2026-10-27T12:00:00Z");

const all = [
  newDealPayload(deal),
  customerPaidPayload(deal),
  depositCompletePayload({ ...deal, coins: "500 USDT", rateToAgree: false }),
  depositCompletePayload({ ...deal, coins: "0.01 BTC", rateToAgree: true }),
  payoutOverduePayload({
    ...deal,
    dueAt: new Date(NOW.getTime() - 4 * 60_000),
    now: NOW,
  }),
  whatsappHandoverPayload(),
  dealCancelledPayload(deal),
  TEST_PAYLOAD,
];

describe("notification payloads", () => {
  it("never carry a name, phone number, email or account number", () => {
    for (const p of all) {
      const text = JSON.stringify(p);
      for (const value of [
        ...Object.values(PRIVATE),
        "Adaeze",
        "0199",
        "@",
        "0123456789",
      ])
        expect(text).not.toContain(value);
      expect(Object.keys(p).sort()).toEqual(["body", "tag", "title", "url"]);
      expect(p.url).toMatch(/^\/admin(\/|$)/);
    }
  });

  it("say what happened, with the ref, service and amount", () => {
    expect(newDealPayload(deal)).toEqual({
      title: "New deal · SLZ-1094",
      body: "School fees · 9,500 GBP. Tap to open",
      url: "/admin/deals/SLZ-1094",
      tag: "SLZ-1094",
    });
    expect(customerPaidPayload(deal)).toMatchObject({
      title: "Payment to confirm · SLZ-1094",
      body: "Customer marked as paid",
    });
    expect(
      depositCompletePayload({
        ref: "SLZ-1102",
        coins: "500 USDT",
        rateToAgree: false,
      }),
    ).toMatchObject({
      title: "Deposit complete · SLZ-1102",
      body: "500 USDT received. Payout clock started",
      tag: "SLZ-1102",
    });
    expect(
      payoutOverduePayload({
        ref: "SLZ-1102",
        dueAt: new Date(NOW.getTime() - 4 * 60_000),
        now: NOW,
      }),
    ).toMatchObject({
      title: "Payout overdue · SLZ-1102",
      body: "Due 4 min ago",
    });
    expect(dealCancelledPayload(deal).title).toBe("Deal cancelled · SLZ-1094");
  });
});
