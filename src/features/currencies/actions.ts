"use server";

import { revalidatePath } from "next/cache";

import { currencyInput } from "@/features/currencies/schema";
import { RATE_ERRORS } from "@/features/forex-rates/schema";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";
import { isCheckViolation, isPrismaError } from "@/lib/server/prisma-errors";

// Pages that show currencies and forex rates.
function revalidateForexPages() {
  revalidatePath("/admin/forex");
  revalidatePath("/admin");
  revalidatePath("/admin/generator");
}

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues)
    fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return fieldErrors;
}

// A Currency and its first ForexRate, together or not at all.
const create = safeAction(
  async (
    { organizationId, userId },
    raw: unknown,
  ): Promise<ActionResult<{ id: string; code: string }>> => {
    const parsed = currencyInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: fieldErrorsOf(parsed.error.issues),
      };
    const input = parsed.data;

    try {
      const currency = await db.$transaction(async (tx) => {
        const { _max } = await tx.currency.aggregate({
          where: { organizationId },
          _max: { sortOrder: true },
        });
        const created = await tx.currency.create({
          data: {
            organizationId,
            code: input.code,
            name: input.name,
            symbol: input.symbol || null,
            flagCode: input.flagCode || null,
            status: input.active ? "ACTIVE" : "INACTIVE",
            sortOrder: (_max.sortOrder ?? -1) + 1, // new currencies go last
          },
          select: { id: true, code: true },
        });
        await tx.forexRate.create({
          data: {
            currencyId: created.id,
            buy: input.buy,
            sell: input.sell,
            createdById: userId,
          },
        });
        return created;
      });
      revalidateForexPages();
      return { ok: true, data: currency };
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        const message = `${input.code} already exists. Edit it from the table instead.`;
        return { ok: false, error: message, fieldErrors: { code: message } };
      }
      if (isCheckViolation(error, "forex_sell_gte_buy"))
        return {
          ok: false,
          error: RATE_ERRORS.sellBelowBuy,
          fieldErrors: { sell: RATE_ERRORS.sellBelowBuy },
        };
      throw error;
    }
  },
);

// A "use server" file may only export async functions.
export async function createCurrency(input: unknown) {
  return create(input);
}
