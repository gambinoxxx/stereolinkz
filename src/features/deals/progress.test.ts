import { describe, expect, it } from "vitest";

import { customerStatus, dealSteps } from "@/features/deals/progress";

const t = (m: number) => new Date(Date.UTC(2026, 9, 13, 10, m));

describe("dealSteps", () => {
  it("marks steps done, now and todo from the status, with event times", () => {
    const steps = dealSteps("SCHOOL_FEES", "AWAITING_PAYMENT", t(31), [
      { toStatus: "AGREED", at: t(42) },
      { toStatus: "AWAITING_PAYMENT", at: t(43) },
    ]);
    expect(steps.map((s) => `${s.label}:${s.state}`)).toEqual([
      "Requested:done",
      "Rate agreed:done",
      "Awaiting your payment:now",
      "Payment received:todo",
      "Sent to the school:todo",
      "Completed:todo",
    ]);
    expect(steps[1]!.at).toEqual(t(42));
    expect(steps[3]!.at).toBeNull();
  });

  it("names step 5 for the service", () => {
    expect(dealSteps("FOREX_SELL", "NEW", t(0), [])[4]!.label).toBe(
      "Paid to your account",
    );
    expect(dealSteps("POF", "NEW", t(0), [])[4]!.label).toBe(
      "Statement being arranged",
    );
  });

  it("marks everything done when completed (PROCESSING may be skipped)", () => {
    const steps = dealSteps("FOREX_BUY", "COMPLETED", t(0), [
      { toStatus: "COMPLETED", at: t(50) },
    ]);
    expect(steps.every((s) => s.state === "done")).toBe(true);
  });

  it("keeps a cancelled deal's reached steps and nothing current", () => {
    const steps = dealSteps("SCHOOL_FEES", "CANCELLED", t(0), [
      { toStatus: "AGREED", at: t(5) },
      { toStatus: "CANCELLED", at: t(9) },
    ]);
    expect(steps.map((s) => s.state)).toEqual([
      "done",
      "done",
      "todo",
      "todo",
      "todo",
      "todo",
    ]);
  });
});

describe("customerStatus", () => {
  it("speaks to the customer", () => {
    expect(customerStatus("SCHOOL_FEES", "AWAITING_PAYMENT")).toEqual({
      label: "Awaiting your payment",
      tone: "gold",
    });
    expect(customerStatus("INTL_PAYMENT", "PROCESSING").label).toBe(
      "Sent to the recipient",
    );
    expect(customerStatus("POF", "CANCELLED").tone).toBe("off");
  });
});
