import { describe, expect, it } from "vitest";

import {
  customerLinkEmail,
  teamNewDealEmail,
  teamPaidEmail,
  customerPaidOutEmail,
  teamDepositCompleteEmail,
  teamPayoutOverdueEmail,
  teamRateToAgreeEmail,
} from "@/features/deals/emails";

const d = {
  ref: "SLZ-1047",
  service: "School fees",
  amount: "4,500 GBP",
  estimate: "₦8,280,000",
  adminUrl: "https://x/admin/deals/SLZ-1047",
};

describe("deal emails", () => {
  it("tell the team the ref, service, amount and the admin link", () => {
    const e = teamNewDealEmail(d);
    expect(e.subject).toBe("New deal SLZ-1047 · School fees");
    expect(e.text).toContain("4,500 GBP");
    expect(e.text).toContain("https://x/admin/deals/SLZ-1047");
    expect(e.html).toContain('href="https://x/admin/deals/SLZ-1047"');
  });
  it("never include a phone number or a file", () => {
    for (const e of [
      teamNewDealEmail(d),
      teamPaidEmail({ ...d, toPay: "₦8,262,000" }),
    ]) {
      expect(e.text).not.toMatch(/\+234|\d{4} \d{3} \d{4}|\.pdf|blob\.vercel/);
    }
  });
  it("escape what goes into the HTML", () => {
    expect(teamNewDealEmail({ ...d, service: "<b>x</b>" }).html).toContain(
      "&lt;b&gt;",
    );
  });
  it("send the customer their private link once", () => {
    const e = customerLinkEmail({
      brand: "Stereolinkz",
      ref: "SLZ-1047",
      service: "School fees",
      amount: "4,500 GBP",
      trackUrl: "https://x/deal/SLZ-1047?t=abc",
    });
    expect(e.subject).toBe("Your deal SLZ-1047 with Stereolinkz");
    expect(e.text).toContain("https://x/deal/SLZ-1047?t=abc");
  });
});

describe("crypto emails (Phase 13)", () => {
  it("tell the team the ref, amount and link only", () => {
    const e = teamDepositCompleteEmail({
      ref: "SLZ-1048",
      amount: "500.37 USDT",
      payout: "₦795,588",
      minutes: 10,
      adminUrl: "https://example.test/admin/deals/SLZ-1048",
    });
    expect(e.subject).toBe("SLZ-1048: payout due (₦795,588)");
    expect(e.text).toContain("500.37 USDT");
    expect(e.text).toContain("within 10 minutes");
    expect(e.text).not.toMatch(/T[1-9A-HJ-NP-Za-km-z]{33}/); // no address
    expect(
      teamPayoutOverdueEmail({
        ref: "SLZ-1048",
        amount: "500.37 USDT",
        payout: "₦795,588",
        adminUrl: "https://example.test/admin/deals/SLZ-1048",
      }).subject,
    ).toBe("SLZ-1048: payout overdue");
  });

  it("give the customer the amount, account ending and reference", () => {
    const e = customerPaidOutEmail({
      brand: "Stereolinkz",
      ref: "SLZ-1048",
      payout: "₦795,588",
      account: "Opay ••4567",
      reference: "OPY<1>",
    });
    expect(e.text).toContain("₦795,588 has been sent to your Opay ••4567");
    expect(e.html).toContain("OPY&lt;1&gt;");
  });
});

describe("branded layout", () => {
  const all = [
    teamNewDealEmail(d),
    teamNewDealEmail({ ...d, estimate: null }),
    teamPaidEmail({ ...d, toPay: "₦8,262,000" }),
    teamPaidEmail({ ...d, toPay: null }),
    customerLinkEmail({
      brand: "Stereolinkz",
      ref: "SLZ-1047",
      service: "School fees",
      amount: "4,500 GBP",
      trackUrl: "https://x/deal/SLZ-1047?t=abc",
    }),
    teamDepositCompleteEmail({
      ref: "SLZ-1048",
      amount: "500.37 USDT",
      payout: "₦795,588",
      minutes: 10,
      adminUrl: "https://x/admin/deals/SLZ-1048",
    }),
    teamPayoutOverdueEmail({
      ref: "SLZ-1048",
      amount: "500.37 USDT",
      payout: "₦795,588",
      adminUrl: "https://x/admin/deals/SLZ-1048",
    }),
    customerPaidOutEmail({
      brand: "Stereolinkz",
      ref: "SLZ-1048",
      payout: "₦795,588",
      account: "Opay ••4567",
      reference: "OPY1",
    }),
    teamRateToAgreeEmail({
      ref: "SLZ-1049",
      amount: "0.00488505 BTC",
      adminUrl: "https://x/admin/deals/SLZ-1049",
    }),
  ];

  it("is a full document with the PNG logo", () => {
    for (const e of all) {
      expect(e.html.startsWith("<!doctype html>")).toBe(true);
      expect(e.html).toContain("/email/logo.png");
    }
  });

  it("puts the estimate and the deal button in the new-deal alert", () => {
    const html = teamNewDealEmail(d).html;
    expect(html).toContain("Open deal SLZ-1047");
    expect(html).toContain("₦8,280,000");
  });

  it("marks an overdue payout in the warn tone", () => {
    const overdue = teamPayoutOverdueEmail({
      ref: "SLZ-1048",
      amount: "500.37 USDT",
      payout: "₦795,588",
      adminUrl: "https://x/admin/deals/SLZ-1048",
    });
    expect(overdue.html).toContain("#B4232C");
    expect(teamNewDealEmail(d).html).not.toContain("#B4232C");
  });

  it("never puts WhatsApp links in team alerts", () => {
    for (const e of all) expect(e.html).not.toMatch(/wa\.me|api\.whatsapp/);
  });
});
