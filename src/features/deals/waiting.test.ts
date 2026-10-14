import { describe, expect, it } from "vitest";

import { waiting, waitingText } from "@/features/deals/waiting";

const now = new Date("2026-10-14T10:00:00Z");
const ago = (m: number) => new Date(now.getTime() - m * 60_000);

describe("waiting", () => {
  it("formats minutes, hours and days", () => {
    expect(waitingText(12.7)).toBe("12 min");
    expect(waitingText(61)).toBe("1 h");
    expect(waitingText(47 * 60)).toBe("47 h");
    expect(waitingText(3 * 24 * 60)).toBe("3 d");
  });
  it("colours NEW deals against the contact SLA", () => {
    expect(waiting("NEW", ago(5), now, 15).tone).toBe("normal");
    expect(waiting("NEW", ago(10), now, 15).tone).toBe("soon");
    expect(waiting("NEW", ago(15), now, 15).tone).toBe("late");
  });
  it("flags a received payment left for 30 minutes", () => {
    expect(waiting("PAYMENT_RECEIVED", ago(29), now, 15).tone).toBe("normal");
    expect(waiting("PAYMENT_RECEIVED", ago(31), now, 15).tone).toBe("soon");
  });
  it("leaves other statuses plain and closed deals blank", () => {
    expect(waiting("AWAITING_PAYMENT", ago(500), now, 15)).toEqual({
      text: "8 h",
      tone: "normal",
    });
    expect(waiting("COMPLETED", ago(5), now, 15)).toEqual({
      text: "—",
      tone: "normal",
    });
  });
});
