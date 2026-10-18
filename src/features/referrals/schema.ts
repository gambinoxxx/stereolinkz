// Referral programme inputs (Phase 13c), shared by the admin forms
// (client) and the owner's actions (server).
import { z } from "zod";

import { DESK_SERVICES } from "@/features/deals/services";
import { CODE_PATTERN } from "@/features/referrals/rules";

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T12:00:00Z`)), "Pick a date.");

// Settings → Referrals. Dates are whole days in the org's time zone; the
// end date is the last day the programme is on.
export const referralSettingsInput = z
  .object({
    enabled: z.boolean(),
    startsOn: dateField,
    endsOn: dateField,
    rewardPct: z
      .string()
      .trim()
      .pipe(
        z
          .string()
          .regex(/^\d{1,3}(\.\d{1,2})?$/, "A percentage, like 15.")
          .refine((v) => Number(v) <= 100, "At most 100%."),
      ),
    holdDays: z.coerce
      .number({ error: "Enter days, like 7." })
      .int("Whole days only.")
      .min(0, "0 or more.")
      .max(365, "At most 365 days."),
    newCustomersOnly: z.boolean(),
    monthlyCap: z
      .string()
      .trim()
      .transform((v) => v.replace(/[,₦\s]/g, ""))
      .pipe(
        z
          .string()
          .refine(
            (v) => v === "" || /^\d{1,12}$/.test(v),
            "Whole naira, like 200000, or leave it empty for no cap.",
          ),
      )
      .transform((v) => (v === "" ? null : v)),
    services: z
      .array(z.enum(DESK_SERVICES))
      .min(1, "Pick at least one service."),
  })
  .refine((v) => v.endsOn >= v.startsOn, {
    path: ["endsOn"],
    message: "The end date must be on or after the start date.",
  });
export type ReferralSettingsForm = z.input<typeof referralSettingsInput>;

export const staffCodeInput = z.object({
  membershipId: z.string().min(1, "Pick a team member."),
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(
      z.string().regex(CODE_PATTERN, "4 to 12 letters or digits, like LYDIA."),
    ),
  // Their own number, so their code never counts on their own deals.
  whatsapp: z.string().trim().max(30).optional(),
});

export const rewardIdsInput = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "Select at least one reward.")
    .max(200),
  // Approving a flagged reward needs an explicit "I've checked".
  confirmFlagged: z.boolean().optional(),
});

export const payRewardsInput = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "Select at least one reward.")
    .max(200),
  bankReference: z
    .string()
    .trim()
    .min(3, "Enter the bank transfer reference.")
    .max(60),
  paidOn: dateField,
});

export const voidRewardInput = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(5, "Say why, for the record.").max(200),
});

export const attachCodeInput = z.object({
  ref: z.string(),
  code: z.string().trim().max(40), // empty: remove the code
});
