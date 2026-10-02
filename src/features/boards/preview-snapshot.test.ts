import { describe, expect, it } from "vitest";

import {
  type GeneratorEntities,
  initialFormValues,
} from "@/features/boards/generator-form";
import {
  buildPreviewSnapshot,
  PENDING_VALUE,
} from "@/features/boards/preview-snapshot";
import { FIXTURE_NOW, FIXTURE_ORG } from "@/test/board-fixtures";

const entities: GeneratorEntities = {
  coins: [],
  currencies: [
    {
      id: "usd",
      code: "USD",
      name: "US dollar",
      flagCode: "us",
      buy: "1365.0000",
      sell: "1378.0000",
    },
    {
      id: "gbp",
      code: "GBP",
      name: "British pound",
      flagCode: "gb",
      buy: "1815.0000",
      sell: "1840.0000",
    },
  ],
  banks: [
    {
      id: "wema",
      name: "Wema Bank",
      shortName: "Wema",
      slug: "wema",
      logoUrl: null,
      rate: "3.40",
      note: null,
    },
  ],
};

const forexValues = () =>
  initialFormValues("FOREX", entities, FIXTURE_ORG, "forex/purple-signal", 4);

describe("buildPreviewSnapshot", () => {
  it("shows the prefilled rows and default copy, dated in the org zone", () => {
    const snapshot = buildPreviewSnapshot(
      FIXTURE_ORG,
      "FOREX",
      forexValues(),
      entities,
      FIXTURE_NOW,
    );
    expect(snapshot.type).toBe("FOREX");
    expect(
      snapshot.rows.map((r) => ("code" in r ? [r.code, r.buy, r.sell] : [])),
    ).toEqual([
      ["USD", "1365", "1378"],
      ["GBP", "1815", "1840"],
    ]);
    expect(snapshot.content.headline).toBe("Today’s\nforex rates");
    expect(snapshot.content.timeLabel).toBe("10:25 AM");
  });

  it("never throws: half-typed values show as a dash, sell < buy as typed", () => {
    const values = forexValues();
    values.rows[0] = { ...values.rows[0]!, buy: "13.", sell: "" };
    values.rows[1] = { ...values.rows[1]!, buy: "1900", sell: "1,800" };
    const snapshot = buildPreviewSnapshot(
      FIXTURE_ORG,
      "FOREX",
      values,
      entities,
      FIXTURE_NOW,
    );
    expect(snapshot.rows).toMatchObject([
      { buy: PENDING_VALUE, sell: PENDING_VALUE },
      { buy: "1900", sell: "1800" },
    ]);
  });

  it("leaves unticked rows off, and can have none", () => {
    const values = forexValues();
    values.rows = values.rows.map((row) => ({ ...row, included: false }));
    expect(
      buildPreviewSnapshot(FIXTURE_ORG, "FOREX", values, entities, FIXTURE_NOW)
        .rows,
    ).toEqual([]);
  });

  it("clips content to its limits, and empty text to nothing", () => {
    const values = forexValues();
    values.content = {
      headline: "One\nTwo\nThree",
      subheading: "x".repeat(200),
      note: "   ",
      finePrint: "",
    };
    const { content } = buildPreviewSnapshot(
      FIXTURE_ORG,
      "FOREX",
      values,
      entities,
      FIXTURE_NOW,
    );
    expect(content.headline).toBe("One\nTwo");
    expect(content.subheading).toHaveLength(80);
    expect(content.note).toBeNull();
    expect(content.finePrint).toBeNull();
  });

  it("builds POF rows with names, logos and notes from the entities", () => {
    const values = initialFormValues(
      "POF",
      entities,
      FIXTURE_ORG,
      "pof/daylight",
      6,
    );
    values.rows[0] = {
      ...values.rows[0]!,
      rate: "3.5%",
      note: " New account ",
    };
    const snapshot = buildPreviewSnapshot(
      FIXTURE_ORG,
      "POF",
      values,
      entities,
      FIXTURE_NOW,
    );
    expect(snapshot.rows).toEqual([
      {
        bankId: "wema",
        name: "Wema Bank",
        shortName: "Wema",
        logoUrl: null,
        rate: "3.5",
        note: "New account",
      },
    ]);
    expect(snapshot.content.note).toBeNull();
  });
});
