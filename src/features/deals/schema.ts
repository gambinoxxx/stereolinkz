// Deal input: the per-service details stored on Deal.details
// (dealDetailsV1) and the website submit form. Shared by the forms
// (client) and the server actions. Money is decimal strings throughout.
import { z } from "zod";

import { normalizeWhatsAppNumber } from "@/features/settings/schema";

export const NAME_MAX = 80;
export const TEXT_MAX = 120;
export const NOTE_MAX = 500;
export const COUNTRY_MAX = 56;
export const AMOUNT_MAX = "1000000000"; // one billion units: well above any real deal

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
// Empty means not given; the key is optional on both sides.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v ? v : undefined))
    .optional();

export const SCHOOL_PURPOSES = [
  "TUITION",
  "DEPOSIT",
  "ACCOMMODATION",
  "APPLICATION",
] as const;
export const INTL_PURPOSES = [
  "SUPPLIER",
  "RENT",
  "BILLS",
  "FAMILY",
  "OTHER",
] as const;
export const RECEIVE_METHODS = ["WIRE", "ACH", "LOCAL", "NOT_SURE"] as const;
export const POF_PURPOSES = [
  "STUDY_VISA",
  "VISIT_VISA",
  "SCHOOL_ADMISSION",
  "OTHER",
] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Choose a date.");

// How the payout account name the customer typed compares with their
// name. We have no bank API to look the name up, so this is a soft check.
export const NAME_CHECKS = ["MATCH", "CLOSE", "DIFFERENT"] as const;
export type NameCheck = (typeof NAME_CHECKS)[number];

// Crypto (Phase 13): the coin and network live on the deal's own columns
// too (cryptoTicker, cryptoNetwork); details keep the form's extra facts.
export const cryptoSellDetails = z.object({
  service: z.literal("CRYPTO_SELL"),
  ticker: z.string().regex(/^[A-Z0-9]{2,6}$/),
  network: z.enum(["TRC20", "BEP20"]),
  payoutNameCheck: z.enum(NAME_CHECKS),
});

// The website form's services (Phase 12). Crypto has its own action.
const formDetails = z.discriminatedUnion("service", [
  z.object({
    service: z.literal("SCHOOL_FEES"),
    country: text(2, COUNTRY_MAX),
    schoolName: text(2, TEXT_MAX),
    studentName: text(2, NAME_MAX),
    studentId: optionalText(40),
    purpose: z.enum(SCHOOL_PURPOSES),
    invoiceRequired: z.boolean(),
  }),
  z.object({
    service: z.literal("INTL_PAYMENT"),
    purpose: z.enum(INTL_PURPOSES),
    country: text(2, COUNTRY_MAX),
    receiveMethod: z.enum(RECEIVE_METHODS),
    note: optionalText(NOTE_MAX),
  }),
  z.object({
    service: z.literal("POF"),
    bankId: z.string().min(1).max(40),
    // Copied from the POF board on the server, so a renamed bank still
    // reads as it did when the deal was made.
    bankName: text(1, TEXT_MAX).optional(),
    months: z.number().int().min(1).max(12),
    neededBy: isoDate,
    purpose: z.enum(POF_PURPOSES),
    destinationCountry: text(2, COUNTRY_MAX),
  }),
  z.object({ service: z.literal("FOREX_SELL"), method: z.literal("TRANSFER") }),
  z.object({ service: z.literal("FOREX_BUY"), method: z.literal("TRANSFER") }),
]);

// Deal.details, version 1. A discriminated union by service; crypto was
// added in Phase 13 (additive, like the board snapshot).
export const dealDetailsV1 = z.discriminatedUnion("service", [
  ...formDetails.options,
  cryptoSellDetails,
]);
export type DealDetails = z.infer<typeof dealDetailsV1>;

// "4,500" / " 4500.50 " → "4500.50"; positive, at most 2 decimals, ≤ 1 bn.
export const amountString = z
  .string()
  .transform((v) => v.trim().replace(/[,\s]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount, like 4,500.")
      .refine((v) => Number(v) > 0, "Enter an amount above zero.")
      .refine(
        (v) => Number(v) <= Number(AMOUNT_MAX),
        "That amount is too large. Message us on WhatsApp.",
      ),
  );

// Customers type numbers many ways: "0803…", "+234 803…", "234803…".
export function normalizeCustomerWhatsapp(raw: string): string | null {
  const trimmed = raw.trim();
  const withPlus = /^234\d{10}$/.test(trimmed.replace(/[\s().-]/g, ""))
    ? `+${trimmed}`
    : trimmed;
  return normalizeWhatsAppNumber(withPlus);
}

export const customerInput = z.object({
  name: text(2, NAME_MAX),
  whatsapp: z.string().transform((value, ctx) => {
    const number = normalizeCustomerWhatsapp(value);
    if (!number) {
      ctx.addIssue({
        code: "custom",
        message: "Enter your WhatsApp number, like 0803 123 4567.",
      });
      return z.NEVER;
    }
    return number;
  }),
  email: z
    .string()
    .trim()
    .max(120)
    .transform((v) => v.toLowerCase())
    .pipe(
      z.union([z.literal(""), z.email("Enter an email like you@example.com.")]),
    )
    .transform((v) => (v ? v : undefined)),
});

// Where we pay a customer who sells forex: their own Nigerian account.
// The bank is typed (no list of bank names in code: Invariant 1).
export const payoutInput = z.object({
  bank: text(2, 60),
  accountNumber: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{10}$/, "Enter the 10-digit account number.")),
});

// The website form. `currency` is the ISO code of the amount (NGN for
// POF). The server recomputes every figure; the client sends none.
export const submitDealInput = z
  .object({
    details: formDetails,
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount: amountString,
    customer: customerInput,
    payout: payoutInput.optional(),
    consent: z.literal(true, { error: "Please agree to continue." }),
    // Bot checks (public-actions.ts): a field people never see, and the
    // signed time the form was issued.
    website: z.string().max(200),
    formToken: z.string().max(200),
  })
  .superRefine((value, ctx) => {
    if (value.details.service === "POF" && value.currency !== "NGN")
      ctx.addIssue({
        code: "custom",
        path: ["currency"],
        message: "Proof of funds is in naira.",
      });
    if (value.details.service === "FOREX_SELL" && !value.payout)
      ctx.addIssue({
        code: "custom",
        path: ["payout", "accountNumber"],
        message: "Tell us where to pay your naira.",
      });
  });
export type SubmitDealInput = z.input<typeof submitDealInput>;
export type SubmitDeal = z.output<typeof submitDealInput>;
