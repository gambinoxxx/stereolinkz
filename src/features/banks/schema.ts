// Bank form input, shared by BankDrawer (client) and the bank actions
// (server). code-standards.md → Data and Storage → Validation rules.
import { z } from "zod";

import { bankSlug } from "@/features/banks/slug";

export const SHORT_NAME_MAX = 14;

export const bankInput = z.object({
  name: z
    .string()
    .trim()
    .superRefine((name, ctx) => {
      if (name === "") {
        ctx.addIssue({ code: "custom", message: "Enter the bank’s name." });
      } else if (name.length > 60) {
        ctx.addIssue({
          code: "custom",
          message: "Keep the bank name to 60 characters or fewer.",
        });
      } else if (bankSlug(name) === "") {
        ctx.addIssue({
          code: "custom",
          message: "Enter a bank name, not just “Bank”.",
        });
      }
    }),
  shortName: z
    .string()
    .trim()
    .max(
      SHORT_NAME_MAX,
      `Keep the short name to ${SHORT_NAME_MAX} characters or fewer.`,
    ),
  active: z.boolean(),
});

export type BankInput = z.infer<typeof bankInput>;

// An empty short name defaults to the first word of the name
// ("Wema Bank" → "Wema"), cut to the board limit.
export function resolveShortName(input: BankInput): string {
  if (input.shortName !== "") return input.shortName;
  const firstWord = input.name.split(/\s+/)[0] ?? input.name;
  return firstWord.slice(0, SHORT_NAME_MAX);
}
