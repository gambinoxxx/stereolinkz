// Settings → Deal desk: services, payment accounts, timings and alerts.
// Shared by the settings page (client) and its actions (server).
import { z } from "zod";

import { PHASE12_SERVICES } from "@/features/deals/services";
import { REF_PREFIX_PATTERN } from "@/features/deals/refs";

const phase12Service = z.enum(PHASE12_SERVICES);

export const dealSettingsInput = z.object({
  services: z.array(phase12Service).max(PHASE12_SERVICES.length),
  contactSlaMinutes: z.coerce
    .number({ error: "Enter minutes, like 15." })
    .int("Whole minutes only.")
    .min(1, "At least 1 minute.")
    .max(1440, "At most 1,440 minutes (a day)."),
  dealRefPrefix: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(REF_PREFIX_PATTERN, "2 to 6 letters, like SLZ.")),
  dealAlertEmails: z.boolean(),
  dealDefaultOwnerId: z
    .string()
    .nullable()
    .transform((v) => (v ? v : null)),
});
export type DealSettingsForm = z.input<typeof dealSettingsInput>;
export type DealSettings = z.output<typeof dealSettingsInput>;

// One of our accounts. NGN accounts are Nigerian NUBAN numbers (10
// digits); other currencies allow an IBAN-style number.
export const paymentAccountInput = z
  .object({
    id: z.string().optional(),
    bank: z.string().trim().min(2, "Enter the bank.").max(60),
    accountNumber: z
      .string()
      .transform((v) => v.replace(/[\s-]/g, "").toUpperCase()),
    accountName: z.string().trim().min(2, "Enter the account name.").max(80),
    currency: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{3}$/, "A 3-letter code, like NGN.")),
    services: z.array(phase12Service).min(1, "Pick at least one service."),
    active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const ok =
      value.currency === "NGN"
        ? /^\d{10}$/.test(value.accountNumber)
        : /^[A-Z0-9]{6,34}$/.test(value.accountNumber);
    if (!ok)
      ctx.addIssue({
        code: "custom",
        path: ["accountNumber"],
        message:
          value.currency === "NGN"
            ? "Enter the 10-digit account number."
            : "Enter the account number (6 to 34 letters and digits).",
      });
  });
export type PaymentAccountForm = z.input<typeof paymentAccountInput>;
export type PaymentAccountValues = z.output<typeof paymentAccountInput>;

const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// An account whose name doesn't contain the organization's name gets a
// warning: the rep must tell the customer the name on WhatsApp first.
// "Stereolinkz Ltd" is fine for "Stereolinkz"; "Bopstore Enterprises" isn't.
export function accountNameDiffers(
  accountName: string,
  orgName: string,
): boolean {
  const org = simplify(orgName);
  return org.length > 0 && !simplify(accountName).includes(org);
}

// "1306482951" → "1306 482 951", as on bank apps and the design.
export function formatAccountNumber(value: string): string {
  return /^\d{10}$/.test(value)
    ? `${value.slice(0, 4)} ${value.slice(4, 7)} ${value.slice(7)}`
    : value;
}
