// POF rate input, shared by PofRateDrawer (client) and savePofRate
// (server). Rates stay strings end to end (Invariant 10).
import { z } from "zod";

import { compareDecimalStrings } from "@/lib/decimal";

export const NOTE_MAX = 24;
export const NOTE_SUGGESTIONS = ["New account", "Existing account"] as const;

const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

// What people type: " 3.4 ", "3.4%". Trimmed and a trailing % removed.
export const normalisePercent = (value: string) =>
  value.trim().replace(/\s*%$/, "");

export const PERCENT_ERRORS = {
  format: "Enter a rate like 3.4, with up to 2 decimal places.",
  range: "Rate must be between 0 and 100.",
} as const;

// Percent per month, 0–100, stored as Decimal(5,2).
export const percentInput = z
  .string()
  .transform(normalisePercent)
  .pipe(z.string().regex(PERCENT, PERCENT_ERRORS.format))
  // Zod 4 runs this even after the format check failed, and
  // compareDecimalStrings throws on non-numbers, so check the format first.
  .refine(
    (rate) => !PERCENT.test(rate) || compareDecimalStrings(rate, "100") <= 0,
    { message: PERCENT_ERRORS.range },
  );

// Trimmed, at most 24 characters; empty means no note (null). It also
// accepts its own output (null): the form's resolver can validate a value
// that was already transformed, and must not fail on it.
export const noteInput = z
  .string()
  .nullable()
  .transform((note) => (note ?? "").trim())
  .pipe(
    z
      .string()
      .max(NOTE_MAX, `Keep the note to ${NOTE_MAX} characters or fewer.`),
  )
  .transform((note) => (note === "" ? null : note));

export const pofRateInput = z.object({
  bankId: z.string().min(1, "Pick a bank."),
  rate: percentInput,
  note: noteInput,
  pofActive: z.boolean(),
});

export type PofRateFormInput = z.input<typeof pofRateInput>;
export type PofRateValues = z.output<typeof pofRateInput>;
