"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERCENT_ERRORS, pofRateInput } from "@/features/pof-rates/schema";
import { compareDecimalStrings, toDecimalString } from "@/lib/decimal";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";
import { isCheckViolation, isPrismaError } from "@/lib/server/prisma-errors";

export type SavedPofRate = {
  label: string; // "Providus": the bank's short name, else its name
  rateChanged: boolean;
  firstRate: boolean; // the bank had no rate before (nothing in history yet)
  visibilityChanged: boolean;
  unchanged: boolean;
};

const NOT_FOUND = "This bank no longer exists. Refresh the page.";
const BANK_INACTIVE =
  "This bank is inactive. Activate it on the Banks page first.";
const ACTIVATE_BANK_FIRST = "Activate the bank on the Banks page first";

// Pages that show POF rates (the banks page shows the current rate and
// the record count).
function revalidatePofPages() {
  revalidatePath("/admin/pof");
  revalidatePath("/admin/banks");
  revalidatePath("/admin");
  revalidatePath("/admin/generator");
}

// Rates are insert-only (Invariant 2); visibility is Bank.pofActive, never
// a flag on a rate. A changed rate or note inserts a PofRate; a changed
// switch updates the bank; both happen in one transaction; neither writes
// nothing. Rate edits are allowed on an inactive bank (so history stays
// correct), but adding one or switching its rate on is refused.
const save = safeAction(
  async (
    { organizationId, userId },
    raw: unknown,
    rawMode: unknown,
  ): Promise<ActionResult<SavedPofRate>> => {
    const mode = z.enum(["add", "edit"]).safeParse(rawMode);
    const parsed = pofRateInput.safeParse(raw);
    if (!mode.success) return { ok: false, error: NOT_FOUND };
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
      return { ok: false, error: "Check the highlighted fields.", fieldErrors };
    }
    const input = parsed.data;

    const bank = await db.bank.findFirst({
      where: { id: input.bankId, organizationId },
      select: {
        id: true,
        name: true,
        shortName: true,
        status: true,
        pofActive: true,
        pofRates: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { rate: true, note: true },
        },
      },
    });
    if (!bank || bank.status === "ARCHIVED")
      return { ok: false, error: NOT_FOUND };
    const label = bank.shortName ?? bank.name;

    if (mode.data === "add" && bank.status !== "ACTIVE")
      return {
        ok: false,
        error: BANK_INACTIVE,
        fieldErrors: { bankId: BANK_INACTIVE },
      };

    const current = bank.pofRates[0];
    const rateChanged =
      !current ||
      compareDecimalStrings(toDecimalString(current.rate), input.rate) !== 0 ||
      (current.note ?? null) !== input.note;
    const visibilityChanged = bank.pofActive !== input.pofActive;

    if (visibilityChanged && input.pofActive && bank.status !== "ACTIVE")
      return {
        ok: false,
        error: ACTIVATE_BANK_FIRST,
        fieldErrors: { pofActive: ACTIVATE_BANK_FIRST },
      };

    if (!rateChanged && !visibilityChanged)
      return {
        ok: true,
        data: {
          label,
          rateChanged: false,
          firstRate: false,
          visibilityChanged: false,
          unchanged: true,
        },
      };

    try {
      await db.$transaction(async (tx) => {
        if (rateChanged)
          await tx.pofRate.create({
            data: {
              bankId: bank.id,
              rate: input.rate,
              note: input.note,
              createdById: userId,
            },
          });
        if (visibilityChanged)
          await tx.bank.update({
            where: { id: bank.id, organizationId },
            data: { pofActive: input.pofActive },
          });
      });
    } catch (error) {
      // Safety net behind Zod: the DB CHECK (0 ≤ rate ≤ 100).
      if (isCheckViolation(error, "pof_rate_range"))
        return {
          ok: false,
          error: PERCENT_ERRORS.range,
          fieldErrors: { rate: PERCENT_ERRORS.range },
        };
      if (isPrismaError(error, "P2025")) return { ok: false, error: NOT_FOUND };
      throw error;
    }

    revalidatePofPages();
    return {
      ok: true,
      data: {
        label,
        rateChanged,
        firstRate: !current,
        visibilityChanged,
        unchanged: false,
      },
    };
  },
);

// A "use server" file may only export async functions.
export async function savePofRate(input: unknown, mode: "add" | "edit") {
  return save(input, mode);
}

// The table switch: whether this bank's rate shows on new POF boards.
// Refused for an inactive bank (it wouldn't show anyway).
const setVisibility = safeAction(
  async (
    { organizationId },
    bankId: unknown,
    active: unknown,
  ): Promise<ActionResult<{ label: string; active: boolean }>> => {
    if (typeof bankId !== "string" || typeof active !== "boolean")
      return { ok: false, error: NOT_FOUND };
    const bank = await db.bank.findFirst({
      where: { id: bankId, organizationId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, shortName: true, status: true },
    });
    if (!bank) return { ok: false, error: NOT_FOUND };
    if (active && bank.status !== "ACTIVE")
      return { ok: false, error: ACTIVATE_BANK_FIRST };

    await db.bank.update({
      where: { id: bank.id, organizationId },
      data: { pofActive: active },
    });
    revalidatePofPages();
    return { ok: true, data: { label: bank.shortName ?? bank.name, active } };
  },
);

export async function setPofActive(bankId: string, active: boolean) {
  return setVisibility(bankId, active);
}
