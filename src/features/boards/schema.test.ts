import { describe, expect, it } from "vitest";

import {
  describeIssues,
  type GenerateInput,
  generateInput,
  normaliseHeadline,
} from "@/features/boards/schema";

const content = {
  headline: "Today’s\nforex rates",
  subheading: "Naira per unit",
  note: "",
  finePrint: "Rates can change.",
};

const forex = (
  rows: { id: string; buy: string; sell: string }[],
  overrides: Partial<Extract<GenerateInput, { type: "FOREX" }>> = {},
): GenerateInput => ({
  type: "FOREX",
  templateKey: "forex/purple-signal",
  rows,
  content,
  ...overrides,
});

const row = (id: string, buy = "1365", sell = "1378") => ({ id, buy, sell });

function errorsOf(input: GenerateInput) {
  const parsed = generateInput.safeParse(input);
  if (parsed.success) return null;
  return describeIssues(parsed.error.issues, input, (id) => id.toUpperCase());
}

describe("generateInput", () => {
  it("accepts a valid forex board and normalises values and text", () => {
    const parsed = generateInput.parse(
      forex([row("usd", "1,365", " 1378.5 ")], {
        content: { ...content, headline: " Today’s \r\nforex rates " },
      }),
    );
    expect(parsed.rows[0]).toEqual({ id: "usd", buy: "1365", sell: "1378.5" });
    expect(parsed.content.headline).toBe("Today’s\nforex rates");
    expect(parsed.type === "FOREX" && parsed.content.note).toBeNull(); // "" → null
  });

  it("refuses zero rows", () => {
    expect(errorsOf(forex([]))?.first).toBe(
      "Tick at least one currency to continue.",
    );
  });

  it("refuses more rows than the template fits, with the design's wording", () => {
    const rows = ["usd", "gbp", "eur", "cad", "aud"].map((id) => row(id));
    expect(errorsOf(forex(rows))?.first).toBe(
      "Purple Signal fits 4 currencies. Untick 1 to continue.",
    );
  });

  it("refuses sell below buy, naming the currency", () => {
    const errors = errorsOf(forex([row("usd", "1380", "1370")]));
    expect(errors?.first).toBe(
      "USD: sell must be the same as or higher than buy.",
    );
    expect(errors?.fieldErrors["rows.usd.sell"]).toBeDefined();
  });

  it("refuses a headline of 3 lines, and lines too long for the board", () => {
    expect(
      errorsOf(
        forex([row("usd")], { content: { ...content, headline: "A\nB\nC" } }),
      )?.fieldErrors["content.headline"],
    ).toBe("Keep the headline to 2 lines.");
    expect(
      errorsOf(
        forex([row("usd")], {
          content: { ...content, headline: "Send money now\nrates" },
        }),
      )?.first,
    ).toBe("Keep each headline line to 13 characters so it fits the board.");
    expect(
      errorsOf(
        forex([row("usd")], { content: { ...content, headline: " \n " } }),
      )?.first,
    ).toBe("Add a headline.");
  });

  it("refuses a template of the other type, or one that isn't registered", () => {
    expect(
      errorsOf(forex([row("usd")], { templateKey: "pof/purple-signal" }))
        ?.fieldErrors.templateKey,
    ).toBe("That template isn't available. Pick another one.");
    expect(
      errorsOf(forex([row("usd")], { templateKey: "forex/nope" }))?.fieldErrors
        .templateKey,
    ).toBeDefined();
  });

  it("refuses the same row twice", () => {
    expect(errorsOf(forex([row("usd"), row("usd")]))?.first).toBe(
      "A rate appears twice. Refresh the page and try again.",
    );
  });

  it("checks POF rows with the Phase 5 rules and counts banks", () => {
    const pof = (rows: { id: string; rate: string; note: string | null }[]) =>
      ({
        type: "POF",
        templateKey: "pof/daylight",
        rows,
        content: {
          headline: "Proof of\nfunds rates",
          subheading: "",
          finePrint: "",
        },
      }) satisfies GenerateInput;
    expect(
      generateInput.parse(
        pof([{ id: "wema", rate: "3.4%", note: " New account " }]),
      ).rows[0],
    ).toEqual({ id: "wema", rate: "3.4", note: "New account" });
    expect(
      errorsOf(pof([{ id: "wema", rate: "120", note: null }]))?.first,
    ).toBe("WEMA: rate must be between 0 and 100.");
    const seven = Array.from({ length: 7 }, (_, i) => ({
      id: `b${i}`,
      rate: "3",
      note: null,
    }));
    expect(errorsOf(pof(seven))?.first).toBe(
      "Daylight fits 6 banks. Untick 1 to continue.",
    );
  });

  it("limits the other content fields", () => {
    expect(
      errorsOf(
        forex([row("usd")], { content: { ...content, note: "x".repeat(91) } }),
      )?.first,
    ).toBe("Keep the note to 90 characters or fewer.");
    expect(
      errorsOf(
        forex([row("usd")], {
          content: { ...content, finePrint: "x".repeat(121) },
        }),
      )?.first,
    ).toBe("Keep the small print to 120 characters or fewer.");
  });
});

describe("normaliseHeadline", () => {
  it("trims each line and joins with \\n", () => {
    expect(normaliseHeadline("  Today’s \r\n forex rates\n")).toBe(
      "Today’s\nforex rates",
    );
  });
});
