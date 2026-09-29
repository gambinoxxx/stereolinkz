// Add-currency input, shared by CurrencyDrawer (client) and createCurrency
// (server). code-standards.md → Data and Storage → Validation rules.
import { z } from "zod";

import { checkRatePair, decimalInput } from "@/features/forex-rates/schema";
import { FLAG_CODES } from "@/features/templates/assets/flags";

export const currencyInput = z
  .object({
    code: z
      .string()
      .transform((value) => value.trim().toUpperCase())
      .pipe(
        z.string().regex(/^[A-Z]{3}$/, "Enter the 3-letter currency code."),
      ),
    name: z
      .string()
      .trim()
      .min(1, "Enter the name shown on boards.")
      .max(40, "Keep the name to 40 characters or fewer."),
    symbol: z
      .string()
      .trim()
      .max(4, "Keep the symbol to 4 characters or fewer."),
    flagCode: z.union([z.enum(FLAG_CODES), z.literal("")], {
      error: "Pick a flag from the list, or No flag.",
    }),
    active: z.boolean(),
    buy: decimalInput,
    sell: decimalInput,
  })
  .superRefine(checkRatePair);

export type CurrencyInput = z.input<typeof currencyInput>;
export type CurrencyValues = z.output<typeof currencyInput>;
