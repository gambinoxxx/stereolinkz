import { describe, expect, it } from "vitest";

import {
  formatBoardDate,
  formatBoardPrice,
  formatBoardTime,
  formatBoardDay,
  formatDayHeading,
  formatShortDateTime,
  startOfDayInTimeZone,
  formatUpdatedAt,
  formatLongDate,
  formatPercent,
  formatPoints,
  formatRate,
  isSameOrgDay,
} from "@/lib/format";

const LAGOS = "Africa/Lagos"; // UTC+1, no daylight saving

describe("formatRate", () => {
  it("groups thousands and drops trailing zeros", () => {
    expect(formatRate("1365.0000")).toBe("1,365");
    expect(formatRate("1365.5000")).toBe("1,365.5");
    expect(formatRate("1234567.25")).toBe("1,234,567.25");
    expect(formatRate("0.5000")).toBe("0.5");
    expect(formatRate("-4.5")).toBe("-4.5");
  });

  it("rejects text that is not a decimal", () => {
    expect(() => formatRate("1,365")).toThrow();
    expect(() => formatRate("abc")).toThrow();
  });
});

describe("formatBoardPrice", () => {
  it("has no thousands separator", () => {
    expect(formatBoardPrice("1365.0000")).toBe("1365");
    expect(formatBoardPrice("1365.2500")).toBe("1365.25");
  });
});

describe("formatPercent", () => {
  it("drops trailing zeros", () => {
    expect(formatPercent("3.40")).toBe("3.4%");
    expect(formatPercent("3.00")).toBe("3%");
    expect(formatPercent("2.25")).toBe("2.25%");
  });
});

describe("formatPoints", () => {
  it("adds pts", () => {
    expect(formatPoints("0.1")).toBe("0.1 pts");
    expect(formatPoints("0.10")).toBe("0.1 pts");
  });
});

describe("board dates in the org time zone", () => {
  const morning = new Date("2026-09-27T09:25:00Z"); // 10:25 in Lagos

  it("formats the board date with our month names", () => {
    expect(formatBoardDate(morning, LAGOS)).toBe("Sun, 27 Sept 2026");
    expect(formatBoardDate(new Date("2026-06-03T12:00:00Z"), LAGOS)).toBe(
      "Wed, 3 Jun 2026",
    );
  });

  it("formats the time with a normal space before AM/PM", () => {
    expect(formatBoardTime(morning, LAGOS)).toBe("10:25 AM");
    expect(formatBoardTime(new Date("2026-09-27T11:14:00Z"), LAGOS)).toBe(
      "12:14 PM",
    );
    expect(formatBoardTime(new Date("2026-09-26T23:05:00Z"), LAGOS)).toBe(
      "12:05 AM",
    );
    expect(formatBoardTime(new Date("2026-09-27T20:00:00Z"), LAGOS)).toBe(
      "9:00 PM",
    );
  });

  it("uses Lagos, not UTC, at midnight", () => {
    // 23:30 UTC on Saturday 26 Sept is 00:30 on Sunday 27 Sept in Lagos.
    const edge = new Date("2026-09-26T23:30:00Z");
    expect(formatBoardDate(edge, LAGOS)).toBe("Sun, 27 Sept 2026");
    expect(formatBoardTime(edge, LAGOS)).toBe("12:30 AM");
    expect(formatBoardDate(edge, "UTC")).toBe("Sat, 26 Sept 2026");
    expect(isSameOrgDay(edge, morning, LAGOS)).toBe(true);
    expect(isSameOrgDay(edge, morning, "UTC")).toBe(false);
  });

  it("formats the long date", () => {
    expect(formatLongDate(morning, LAGOS)).toBe("Sunday, 27 September 2026");
  });
});

describe("formatDayHeading", () => {
  const now = new Date("2026-09-27T09:25:00Z");

  it("says Today for the same Lagos day", () => {
    expect(formatDayHeading(new Date("2026-09-26T23:30:00Z"), now, LAGOS)).toBe(
      "Today",
    );
  });

  it("gives the full date for yesterday", () => {
    expect(formatDayHeading(new Date("2026-09-26T11:14:00Z"), now, LAGOS)).toBe(
      "Saturday, 26 September 2026",
    );
  });

  it("gives the full date for the same day last year", () => {
    expect(formatDayHeading(new Date("2025-09-27T09:25:00Z"), now, LAGOS)).toBe(
      "Saturday, 27 September 2025",
    );
  });
});

describe("formatUpdatedAt", () => {
  const TZ = "Africa/Lagos";
  const now = new Date("2026-09-27T15:00:00Z"); // 4:00 PM Sunday in Lagos

  it("shows today's time in the org zone", () => {
    expect(formatUpdatedAt(new Date("2026-09-27T09:25:00Z"), now, TZ)).toBe(
      "Today, 10:25 AM",
    );
  });

  it("counts Lagos midnight, not UTC midnight", () => {
    // 23:30 UTC on the 26th is 00:30 on the 27th in Lagos.
    expect(formatUpdatedAt(new Date("2026-09-26T23:30:00Z"), now, TZ)).toBe(
      "Today, 12:30 AM",
    );
    // 22:30 UTC on the 26th is 23:30 on the 26th in Lagos.
    expect(formatUpdatedAt(new Date("2026-09-26T22:30:00Z"), now, TZ)).toBe(
      "26 Sept",
    );
  });

  it("shows the short date for earlier days, with the year only when it differs", () => {
    expect(formatUpdatedAt(new Date("2026-09-22T08:00:00Z"), now, TZ)).toBe(
      "22 Sept",
    );
    expect(formatUpdatedAt(new Date("2025-12-31T12:00:00Z"), now, TZ)).toBe(
      "31 Dec 2025",
    );
  });
});

describe("formatShortDateTime", () => {
  it("prints date and time in the org zone", () => {
    const now = new Date("2026-09-27T15:00:00Z");
    expect(
      formatShortDateTime(
        new Date("2026-09-26T07:55:00Z"),
        now,
        "Africa/Lagos",
      ),
    ).toBe("26 Sept, 8:55 AM");
  });
});

describe("formatBoardDay", () => {
  const now = new Date("2026-09-27T09:00:00Z");
  it("says Today in the org zone, else a short weekday date", () => {
    expect(formatBoardDay(new Date("2026-09-26T23:30:00Z"), now, LAGOS)).toBe(
      "Today",
    );
    expect(formatBoardDay(new Date("2026-09-25T10:40:00Z"), now, LAGOS)).toBe(
      "Fri 25 Sept",
    );
    expect(formatBoardDay(new Date("2025-09-25T10:40:00Z"), now, LAGOS)).toBe(
      "Thu 25 Sept 2025",
    );
  });
});

describe("startOfDayInTimeZone", () => {
  const at = (iso: string) => new Date(iso).toISOString();

  it("starts Lagos days at 23:00 UTC the day before", () => {
    expect(
      at(
        startOfDayInTimeZone(
          new Date("2026-09-27T10:00:00Z"),
          LAGOS,
        ).toISOString(),
      ),
    ).toBe("2026-09-26T23:00:00.000Z");
    // 00:05 in Lagos is already the new day; 23:55 is not.
    expect(
      startOfDayInTimeZone(
        new Date("2026-09-26T23:05:00Z"),
        LAGOS,
      ).toISOString(),
    ).toBe("2026-09-26T23:00:00.000Z");
    expect(
      startOfDayInTimeZone(
        new Date("2026-09-26T22:55:00Z"),
        LAGOS,
      ).toISOString(),
    ).toBe("2026-09-25T23:00:00.000Z");
  });

  it("follows London's daylight saving", () => {
    const LONDON = "Europe/London";
    expect(
      startOfDayInTimeZone(
        new Date("2026-07-01T12:00:00Z"),
        LONDON,
      ).toISOString(),
    ).toBe("2026-06-30T23:00:00.000Z"); // BST
    expect(
      startOfDayInTimeZone(
        new Date("2026-12-01T12:00:00Z"),
        LONDON,
      ).toISOString(),
    ).toBe("2026-12-01T00:00:00.000Z"); // GMT
    // 29 March 2026: clocks go forward at 01:00 GMT; the day began at 00:00 GMT.
    expect(
      startOfDayInTimeZone(
        new Date("2026-03-29T15:00:00Z"),
        LONDON,
      ).toISOString(),
    ).toBe("2026-03-29T00:00:00.000Z");
    // 25 October 2026: clocks go back at 01:00 GMT; the day began at 23:00 UTC on the 24th.
    expect(
      startOfDayInTimeZone(
        new Date("2026-10-25T15:00:00Z"),
        LONDON,
      ).toISOString(),
    ).toBe("2026-10-24T23:00:00.000Z");
  });
});
