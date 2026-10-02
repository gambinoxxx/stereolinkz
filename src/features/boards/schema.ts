// The generator's input, shared by the form (client) and generateBoard
// (server). The client sends ids, values and text only; the server loads
// names, flags, logos, brand and status itself (architecture.md →
// Generate flow).
import { z } from "zod";

import type { BoardType } from "@/features/boards/defaults";
import { checkRatePair, decimalInput } from "@/features/forex-rates/schema";
import { noteInput, percentInput } from "@/features/pof-rates/schema";
import { getTemplate, isTemplateKey } from "@/features/templates/registry";

// Content limits: the snapshot's (boardSnapshotV1) plus the headline's
// per-line limit. 13 characters at 124px / 800 fits the board's 936px
// text column for ordinary text (measured with Satori: "Weekend deals"
// 886px, "Mid-week rates" (14) 889px but "Send money now" (14) 1001px).
// Wider lines (capitals, W and M) are still clipped by the template, and
// the live preview shows that.
export const CONTENT_LIMITS = {
  headline: 60,
  headlineLines: 2,
  headlineLine: 13,
  subheading: 80,
  note: 90,
  finePrint: 120,
} as const;

export const ROW_NOUN: Record<BoardType, { one: string; many: string }> = {
  FOREX: { one: "currency", many: "currencies" },
  POF: { one: "bank", many: "banks" },
  CRYPTO: { one: "coin", many: "coins" },
};

// "Today’s \r\nforex rates " → "Today’s\nforex rates": Windows line ends,
// and spaces around each line, removed.
export function normaliseHeadline(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

const headline = z
  .string()
  .transform(normaliseHeadline)
  .superRefine((value, ctx) => {
    const lines = value.split("\n");
    const message =
      value === ""
        ? "Add a headline."
        : lines.length > CONTENT_LIMITS.headlineLines
          ? "Keep the headline to 2 lines."
          : lines.some((line) => line.length > CONTENT_LIMITS.headlineLine)
            ? `Keep each headline line to ${CONTENT_LIMITS.headlineLine} characters so it fits the board.`
            : value.length > CONTENT_LIMITS.headline
              ? `Keep the headline to ${CONTENT_LIMITS.headline} characters.`
              : null;
    if (message) ctx.addIssue({ code: "custom", message });
  });

// Trimmed; empty means "leave it off the board" (null). Accepts its own
// output (null) too.
const optionalText = (max: number, label: string) =>
  z
    .string()
    .nullable()
    .transform((value) => (value ?? "").trim())
    .pipe(
      z.string().max(max, `Keep the ${label} to ${max} characters or fewer.`),
    )
    .transform((value) => (value === "" ? null : value));

const sharedContent = {
  headline,
  subheading: optionalText(CONTENT_LIMITS.subheading, "subheading"),
  finePrint: optionalText(CONTENT_LIMITS.finePrint, "small print"),
};

const id = z.string().min(1);

export const generateInput = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("FOREX"),
      templateKey: z.string(),
      rows: z.array(
        z
          .object({ id, buy: decimalInput, sell: decimalInput })
          .superRefine(checkRatePair),
      ),
      content: z.object({
        ...sharedContent,
        note: optionalText(CONTENT_LIMITS.note, "note"),
      }),
    }),
    // Coins use the forex value rules: naira per $1, sell ≥ buy.
    z.object({
      type: z.literal("CRYPTO"),
      templateKey: z.string(),
      rows: z.array(
        z
          .object({ id, buy: decimalInput, sell: decimalInput })
          .superRefine(checkRatePair),
      ),
      content: z.object({
        ...sharedContent,
        note: optionalText(CONTENT_LIMITS.note, "note"),
      }),
    }),
    z.object({
      type: z.literal("POF"),
      templateKey: z.string(),
      rows: z.array(z.object({ id, rate: percentInput, note: noteInput })),
      content: z.object(sharedContent),
    }),
  ])
  // Zod 4 runs this even when a field above failed, so it reads only
  // type, templateKey and the row count, and checks their shape first.
  .superRefine((input, ctx) => {
    if (!isTemplateKey(input.templateKey, input.type)) {
      ctx.addIssue({
        code: "custom",
        path: ["templateKey"],
        message: "That template isn't available. Pick another one.",
      });
      return;
    }
    const template = getTemplate(input.templateKey);
    const noun = ROW_NOUN[input.type];
    const count = input.rows.length;
    if (count === 0)
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: `Tick at least one ${noun.one} to continue.`,
      });
    else if (count > template.maxRows)
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: `${template.name} fits ${template.maxRows} ${noun.many}. Untick ${count - template.maxRows} to continue.`,
      });
    if (new Set(input.rows.map((row) => row.id)).size !== count)
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "A rate appears twice. Refresh the page and try again.",
      });
  });

export type GenerateInput = z.input<typeof generateInput>;
export type GenerateValues = z.output<typeof generateInput>;

export type GeneratorErrors = {
  first: string | null;
  // "rows.<id>.<field>", "content.<field>", "rows" or "templateKey"
  fieldErrors: Record<string, string>;
};

// "Sell must be…" → "USD: sell must be…". Field errors are keyed by row id
// (not index), so the form can map them back after rows are filtered.
export function describeIssues(
  issues: z.core.$ZodIssue[],
  input: { rows: { id: string }[] },
  labelFor: (id: string) => string,
): GeneratorErrors {
  const fieldErrors: Record<string, string> = {};
  let first: string | null = null;
  for (const issue of issues) {
    const [area, index, field] = issue.path;
    let key: string;
    let message = issue.message;
    if (area === "rows" && typeof index === "number") {
      const rowId = input.rows[index]?.id ?? String(index);
      key = `rows.${rowId}.${String(field ?? "")}`;
      message = `${labelFor(rowId)}: ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
    } else if (area === "content") {
      key = `content.${String(index)}`;
    } else {
      key = String(area ?? "form");
    }
    fieldErrors[key] ??= message;
    first ??= message;
  }
  return { first, fieldErrors };
}
