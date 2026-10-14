import { describe, expect, it } from "vitest";

import {
  customerLinkEmail,
  teamNewDealEmail,
  teamPaidEmail,
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
