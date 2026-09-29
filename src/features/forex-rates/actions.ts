"use server";

import { revalidatePath } from "next/cache";

import { forexRateInput, RATE_ERRORS } from "@/features/forex-rates/schema";
import { compareDecimalStrings, toDecimalString } from "@/lib/decimal";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";
import { isCheckViolation } from "@/lib/server/prisma-errors";

export type SavedForexRate = { code: string; unchanged: boolean };

const NOT_FOUND = "This currency no longer exists. Refresh the page.";

// Pages that show forex rates.
function revalidateForexPages() {
  revalidatePath("/admin/forex");
  revalidatePath("/admin");
  revalidatePath("/admin/generator");
}

// Rates are insert-only (Invariant 2): saving adds a ForexRate row and
// never touches the previous one. Unchanged values insert nothing.
const save = safeAction(
  async (
    { organizationId, userId },
    raw: unknown,
  ): Promise<ActionResult<SavedForexRate>> => {
    const parsed = forexRateInput.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
      return { ok: false, error: "Check the highlighted fields.", fieldErrors };
    }
    const input = parsed.data;

    // Scoped through the org, so a rate can only be added to our currency.
    const currency = await db.currency.findFirst({
      where: { id: input.currencyId, organizationId },
      select: {
        id: true,
        code: true,
        rates: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { buy: true, sell: true },
        },
      },
    });
    if (!currency) return { ok: false, error: NOT_FOUND };

    const current = currency.rates[0];
    if (
      current &&
      compareDecimalStrings(toDecimalString(current.buy), input.buy) === 0 &&
      compareDecimalStrings(toDecimalString(current.sell), input.sell) === 0
    ) {
      return { ok: true, data: { code: currency.code, unchanged: true } };
    }

    try {
      await db.forexRate.create({
        data: {
          currencyId: currency.id,
          buy: input.buy,
          sell: input.sell,
          createdById: userId,
        },
      });
    } catch (error) {
      // Safety net behind the Zod check: the DB CHECK (sell >= buy).
      if (isCheckViolation(error, "forex_sell_gte_buy"))
        return {
          ok: false,
          error: RATE_ERRORS.sellBelowBuy,
          fieldErrors: { sell: RATE_ERRORS.sellBelowBuy },
        };
      throw error;
    }

    revalidateForexPages();
    return { ok: true, data: { code: currency.code, unchanged: false } };
  },
);

// A "use server" file may only export async functions.
export async function saveForexRate(input: unknown) {
  return save(input);
}
