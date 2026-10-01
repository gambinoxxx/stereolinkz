import { describe, expect, it } from "vitest";

import { prefillFromSnapshot } from "@/features/boards/prefill";
import { forexFixture, pofFixture } from "@/test/board-fixtures";

const forex = forexFixture(); // USD 1365/1378, GBP 1815/1840, EUR 1560/1583
const ids = forex.type === "FOREX" ? forex.rows.map((r) => r.currencyId) : [];

const data = {
  defaultTemplates: { FOREX: "forex/purple-signal", POF: "pof/purple-signal" },
  banks: [],
  // Today: USD has moved, GBP is the same, EUR is no longer active (absent),
  // CAD is new and wasn't on the board. Today's order puts GBP first.
  currencies: [
    {
      id: ids[1]!,
      code: "GBP",
      name: "British pound",
      flagCode: "gb",
      buy: "1815.0000",
      sell: "1840.0000",
    },
    {
      id: ids[0]!,
      code: "USD",
      name: "US dollar",
      flagCode: "us",
      buy: "1370.0000",
      sell: "1385.0000",
    },
    {
      id: "cad",
      code: "CAD",
      name: "Canadian dollar",
      flagCode: "ca",
      buy: "990.0000",
      sell: "1000.0000",
    },
  ],
};

describe("prefillFromSnapshot", () => {
  it("maps snapshot values onto today's rows in today's order", () => {
    const prefill = prefillFromSnapshot(forex, "forex/daylight", data)!;
    expect(prefill.type).toBe("FOREX");
    expect(prefill.values.templateKey).toBe("forex/daylight");
    expect(
      prefill.values.rows.map((r) => [r.id, r.included, r.buy, r.sell]),
    ).toEqual([
      [ids[1], true, "1815", "1840"],
      [ids[0], true, "1365", "1378"], // the board's value; today's 1370/1385 stays the original
      ["cad", false, "990", "1000"], // not on the board: present, unticked
    ]);
  });

  it("skips rows that are no longer active, with a notice", () => {
    expect(
      prefillFromSnapshot(forex, "forex/purple-signal", data)!.skippedNotice,
    ).toBe("Skipped 1 item that is no longer active: EUR.");
  });

  it("copies content from the snapshot, but no date or brand", () => {
    const { content } = prefillFromSnapshot(
      forex,
      "forex/purple-signal",
      data,
    )!.values;
    expect(content).toEqual({
      headline: forex.content.headline,
      subheading: forex.content.subheading ?? "",
      note: forex.content.note ?? "",
      finePrint: forex.content.finePrint ?? "",
    });
  });

  it("falls back to the default template when the board's is gone", () => {
    expect(
      prefillFromSnapshot(forex, "forex/retired", data)!.values.templateKey,
    ).toBe("forex/purple-signal");
  });

  it("maps POF rates and notes by bank id", () => {
    const pof = pofFixture();
    const bankIds = pof.type === "POF" ? pof.rows.map((r) => r.bankId) : [];
    const prefill = prefillFromSnapshot(pof, "pof/purple-signal", {
      ...data,
      currencies: [],
      banks: [
        {
          id: bankIds[1]!,
          name: "Providus Bank",
          shortName: "Providus",
          slug: "providus",
          logoUrl: null,
          rate: "3.50",
          note: null,
        },
      ],
    })!;
    expect(prefill.values.rows).toEqual([
      {
        id: bankIds[1],
        included: true,
        buy: "",
        sell: "",
        rate: "3.4",
        note: "New account",
      },
    ]);
    expect(prefill.skippedNotice).toMatch(
      /^Skipped 5 items that are no longer active: Wema, /,
    );
  });
});
