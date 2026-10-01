// Organization settings, shared by the Settings form (client) and
// updateOrgSettings (server).
import { z } from "zod";

export const NAME_MIN = 2;
export const NAME_MAX = 40;
export const FINE_PRINT_MAX = 120;

export const WHATSAPP_ERROR = "Enter a WhatsApp number like +234 803 123 4567.";
export const COLOUR_ERROR = "Enter a colour like #6A35D9.";

// "+234 803 123 4567", "+2348031234567", "08031234567", "0803-123-4567"
// → "+234 803 123 4567". A leading 0 is a Nigerian local number (+234);
// "00" is an international prefix. The result must be + and 8–15 digits.
// Nigerian numbers are stored grouped 3-3-4; others as + and digits, since
// grouping differs by country. Returns null when it can't be a number.
export function normalizeWhatsAppNumber(raw: string): string | null {
  let digits = raw.trim().replace(/[\s().-]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  else if (digits.startsWith("0")) digits = `+234${digits.slice(1)}`;
  if (!/^\+\d{8,15}$/.test(digits)) return null;
  const national = digits.slice(4);
  if (digits.startsWith("+234") && national.length === 10)
    return `+234 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  return digits;
}

// "#6a35d9" → "#6A35D9"; "#abc" → "#AABBCC". Null when not a colour.
export function normalizeHexColour(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(value)) return value;
  if (/^#[0-9A-F]{3}$/.test(value))
    return `#${[...value.slice(1)].map((c) => c + c).join("")}`;
  return null;
}

// Every IANA zone the runtime knows (Node and browsers agree on these).
export function isTimeZone(value: string): boolean {
  return (Intl.supportedValuesOf("timeZone") as string[]).includes(value);
}

const colour = z.string().transform((value, ctx) => {
  const hex = normalizeHexColour(value);
  if (!hex) ctx.addIssue({ code: "custom", message: COLOUR_ERROR });
  return hex ?? value;
});

export const orgSettingsInput = z.object({
  name: z
    .string()
    .trim()
    .min(NAME_MIN, `Enter a company name of at least ${NAME_MIN} characters.`)
    .max(NAME_MAX, `Keep the company name to ${NAME_MAX} characters or fewer.`),
  contactLine: z.string().transform((value, ctx) => {
    const number = normalizeWhatsAppNumber(value);
    if (!number) ctx.addIssue({ code: "custom", message: WHATSAPP_ERROR });
    return number ?? value;
  }),
  // Optional: empty means none. Accepts its own output (null).
  email: z
    .string()
    .nullable()
    .transform((value) => (value ?? "").trim())
    .pipe(
      z.union([
        z.literal(""),
        z.email("Enter a valid email address, or leave it empty."),
      ]),
    )
    .transform((value) => (value === "" ? null : value.toLowerCase())),
  backgroundColor: colour,
  primaryColor: colour,
  accentColor: colour,
  timezone: z
    .string()
    .refine(isTimeZone, { message: "Pick a time zone from the list." }),
  // Empty → null: each board type keeps its own default small print.
  defaultFinePrint: z
    .string()
    .nullable()
    .transform((value) => (value ?? "").trim())
    .pipe(
      z
        .string()
        .max(
          FINE_PRINT_MAX,
          `Keep the small print to ${FINE_PRINT_MAX} characters or fewer.`,
        ),
    )
    .transform((value) => (value === "" ? null : value)),
});

export type OrgSettingsForm = z.input<typeof orgSettingsInput>;
export type OrgSettings = z.output<typeof orgSettingsInput>;
