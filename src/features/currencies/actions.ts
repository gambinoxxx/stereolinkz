"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isSameIdSet } from "@/lib/order";
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

const NOT_FOUND = "This currency no longer exists. Refresh the page.";

const statusInput = z.enum(["ACTIVE", "INACTIVE"]);

// Status lives on the Currency (never on rate rows).
const setStatus = safeAction(
  async (
    { organizationId },
    id: unknown,
    status: unknown,
  ): Promise<ActionResult<{ code: string; status: "ACTIVE" | "INACTIVE" }>> => {
    const parsed = statusInput.safeParse(status);
    if (typeof id !== "string" || !parsed.success)
      return { ok: false, error: NOT_FOUND };
    try {
      const currency = await db.currency.update({
        where: { id, organizationId },
        data: { status: parsed.data },
        select: { code: true },
      });
      revalidateForexPages();
      return { ok: true, data: { code: currency.code, status: parsed.data } };
    } catch (error) {
      if (isPrismaError(error, "P2025")) return { ok: false, error: NOT_FOUND };
      throw error;
    }
  },
);

const STALE_ORDER = "The list changed. Refresh and try again.";

// Board order: sortOrder = position, for every non-archived currency at
// once, so a partial (filtered) list can never be saved.
const reorder = safeAction(
  async ({ organizationId }, raw: unknown): Promise<ActionResult<null>> => {
    const parsed = z.array(z.string().min(1)).max(500).safeParse(raw);
    if (!parsed.success) return { ok: false, error: STALE_ORDER };
    const ordered = parsed.data;

    const saved = await db.$transaction(async (tx) => {
      const existing = await tx.currency.findMany({
        where: { organizationId, status: { not: "ARCHIVED" } },
        select: { id: true },
      });
      if (
        !isSameIdSet(
          ordered,
          existing.map((c) => c.id),
        )
      )
        return false;
      for (const [index, id] of ordered.entries()) {
        await tx.currency.update({
          where: { id, organizationId },
          data: { sortOrder: index },
        });
      }
      return true;
    });
    if (!saved) return { ok: false, error: STALE_ORDER };

    revalidateForexPages();
    return { ok: true, data: null };
  },
);

// A "use server" file may only export async functions.
export async function createCurrency(input: unknown) {
  return create(input);
}

export async function setCurrencyStatus(id: string, status: string) {
  return setStatus(id, status);
}

export async function reorderCurrencies(orderedIds: string[]) {
  return reorder(orderedIds);
}
