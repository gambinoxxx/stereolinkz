import { describe, expect, it } from "vitest";

import { buildSnapshot, SnapshotError } from "@/features/boards/build-snapshot";
import { CONTENT_DEFAULTS } from "@/features/boards/defaults";
import {
  FIXTURE_NOW,
  FIXTURE_ORG,
  forexFixture,
  pofFixture,
  SEED_FOREX_ROWS,
} from "@/test/board-fixtures";

describe("buildSnapshot", () => {
  it("builds a valid forex snapshot with the design's defaults", () => {
    const s = forexFixture();
    expect(s.type).toBe("FOREX");
    expect(s.v).toBe(1);
    expect(s.quoteCurrency).toBe("NGN");
    expect(s.rows).toHaveLength(3);
    expect(s.content.headline).toBe("Today’s\nforex rates");
    expect(s.content.ctaLabel).toBe("Send a message to trade");
    expect(s.content.brand).toEqual({
      name: "Stereolinkz",
      logoUrl: null,
      backgroundColor: "#2A0F58",
      primaryColor: "#6A35D9",
      accentColor: "#E9B949",
      contactLine: "+234 800 000 0000",
    });
  });

  it("builds a valid POF snapshot with no note or reach", () => {
    const s = pofFixture();
    expect(s.type).toBe("POF");
    expect(s.rows).toHaveLength(6);
    expect(s.content.note).toBeNull();
    expect(s.content.reach).toBeNull();
    expect(s.content.ctaLabel).toBe("Send a message to apply");
  });

  it("rejects sell below buy", () => {
    expect(() =>
      buildSnapshot({
        org: FIXTURE_ORG,
        type: "FOREX",
        rows: [{ ...SEED_FOREX_ROWS[0]!, buy: "1400", sell: "1399.99" }],
        now: FIXTURE_NOW,
      }),
    ).toThrow(SnapshotError);
  });

  it("rejects a board with no rows", () => {
    expect(() =>
      buildSnapshot({
        org: FIXTURE_ORG,
        type: "POF",
        rows: [],
        now: FIXTURE_NOW,
      }),
    ).toThrow(SnapshotError);
  });

  it("prints the date and time in the org's time zone", () => {
    const s = buildSnapshot({
      org: FIXTURE_ORG,
      type: "FOREX",
      rows: SEED_FOREX_ROWS,
      now: new Date("2026-09-26T23:30:00Z"),
    });
    expect(s.content.dateLabel).toBe("Sun, 27 Sept 2026");
    expect(s.content.timeLabel).toBe("12:30 AM");
  });

  it("lets content overrides replace defaults, including null", () => {
    const s = buildSnapshot({
      org: FIXTURE_ORG,
      type: "FOREX",
      rows: SEED_FOREX_ROWS,
      content: { headline: "Rates\ntoday", note: null },
      now: FIXTURE_NOW,
    });
    expect(s.content.headline).toBe("Rates\ntoday");
    expect(s.content.note).toBeNull();
    expect(s.content.reach).toBe(CONTENT_DEFAULTS.FOREX.reach);
  });

  it("prefers the org's default fine print over the design's", () => {
    expect(forexFixture().content.finePrint).toBe(
      CONTENT_DEFAULTS.FOREX.finePrint,
    );
    const s = buildSnapshot({
      org: {
        ...FIXTURE_ORG,
        defaultFinePrint: "Rates can change without notice.",
      },
      type: "POF",
      rows: pofFixture().rows,
      now: FIXTURE_NOW,
    });
    expect(s.content.finePrint).toBe("Rates can change without notice.");
  });
});
