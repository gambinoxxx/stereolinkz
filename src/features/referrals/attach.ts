import "server-only";

// Attaching a referral code to a deal (Phase 13c): at creation from the
// website form (or ?ref= cookie), or by the team while the deal is NEW or
// AWAITING_DEPOSIT. Two steps:
// 1. checkCode, before anything is written: is the programme on for this
//    service, and is the code known and active? A bad code is a friendly
//    form error; the customer can submit without it.
// 2. decideAttach, inside the deal's transaction: the fraud and
//    new-customer rules. A code that fails them is simply not attached,
//    and the reason is logged on the deal (never shown to the customer).
import {
  acceptsService,
  normalizeCode,
  type ProgrammeSettings,
} from "@/features/referrals/rules";
import type {
  DealService,
  Prisma,
  ReferralKind,
} from "@/generated/prisma/client";
import { db } from "@/lib/server/db";

export type CodeRow = {
  id: string;
  code: string;
  kind: ReferralKind;
  membershipId: string | null;
  customerWhatsapp: string | null;
};

const CODE_SELECT = {
  id: true,
  code: true,
  kind: true,
  membershipId: true,
  customerWhatsapp: true,
  active: true,
} as const;

export const UNKNOWN_CODE =
  "We don’t recognise that referral code. Check it, or leave the box empty.";
export const INACTIVE_CODE =
  "That referral code isn’t active any more. Leave the box empty to continue.";

export type CodeCheck =
  | { ok: true; code: CodeRow | null } // null: no code, or the programme is off
  | { ok: false; error: string };

export async function programmeSettings(
  organizationId: string,
): Promise<ProgrammeSettings & { referralNewCustomersOnly: boolean }> {
  return db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      referralEnabled: true,
      referralStartsAt: true,
      referralEndsAt: true,
      referralServices: true,
      referralNewCustomersOnly: true,
    },
  });
}

export async function checkCode(
  organizationId: string,
  raw: unknown,
  service: DealService,
  now: Date,
): Promise<CodeCheck> {
  if (typeof raw !== "string" || raw.trim() === "")
    return { ok: true, code: null };
  // Off, out of its window or not for this service: ignored, not an error.
  if (!acceptsService(await programmeSettings(organizationId), service, now))
    return { ok: true, code: null };
  const code = normalizeCode(raw);
  if (!code) return { ok: false, error: UNKNOWN_CODE };
  const row = await db.referralCode.findUnique({
    where: { organizationId_code: { organizationId, code } },
    select: CODE_SELECT,
  });
  if (!row) return { ok: false, error: UNKNOWN_CODE };
  if (!row.active) return { ok: false, error: INACTIVE_CODE };
  return {
    ok: true,
    code: {
      id: row.id,
      code: row.code,
      kind: row.kind,
      membershipId: row.membershipId,
      customerWhatsapp: row.customerWhatsapp,
    },
  };
}

export type AttachDecision =
  { attach: true; message: string } | { attach: false; message: string };

// Statuses that make a number a returning customer.
const DONE = ["COMPLETED", "PAID_OUT"] as const;

// The rules that need the database, run inside the deal's transaction.
// `excludeDealId`: when the team attaches to an existing deal.
export async function decideAttach(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    code: CodeRow;
    customerWhatsapp: string;
    newCustomersOnly: boolean;
    excludeDealId?: string;
  },
): Promise<AttachDecision> {
  const { code } = input;
  const notApplied = (why: string) => ({
    attach: false as const,
    message: `Referral code ${code.code} not applied: ${why}`,
  });

  if (code.kind === "STAFF" && code.membershipId) {
    const owner = await tx.membership.findFirst({
      where: { id: code.membershipId, organizationId: input.organizationId },
      select: { whatsapp: true },
    });
    if (owner?.whatsapp && owner.whatsapp === input.customerWhatsapp)
      return notApplied("it’s the code owner’s own WhatsApp number");
  }
  if (
    code.kind === "CUSTOMER" &&
    code.customerWhatsapp === input.customerWhatsapp
  )
    return notApplied("it’s the code owner’s own WhatsApp number");

  if (input.newCustomersOnly) {
    const earlier = await tx.deal.count({
      where: {
        organizationId: input.organizationId,
        customerWhatsapp: input.customerWhatsapp,
        status: { in: [...DONE] },
        ...(input.excludeDealId && { id: { not: input.excludeDealId } }),
      },
    });
    if (earlier > 0)
      return notApplied("this customer has completed a deal with us before");
  }
  return { attach: true, message: `Referral code ${code.code} applied` };
}
