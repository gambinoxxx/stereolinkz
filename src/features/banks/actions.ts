"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { bankInput, resolveShortName } from "@/features/banks/schema";
import { bankSlug } from "@/features/banks/slug";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";
import { isPrismaError } from "@/lib/server/prisma-errors";

export type SavedBank = { id: string; name: string };

const NOT_FOUND = "This bank no longer exists. Refresh the page.";

// Pages that list banks (the POF page and dashboard show them from Phases 5 and 9).
function revalidateBankPages() {
  revalidatePath("/admin/banks");
  revalidatePath("/admin/pof");
  revalidatePath("/admin");
}

function invalidInput(
  issues: { path: PropertyKey[]; message: string }[],
): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= issue.message;
  }
  return { ok: false, error: "Check the highlighted fields.", fieldErrors };
}

// The same slug means the same bank ("Eco Bank" = "Ecobank"). Name the
// bank that already has it, so the admin knows which one to edit.
async function duplicateName(
  organizationId: string,
  slug: string,
  enteredName: string,
): Promise<ActionResult<never>> {
  const existing = await db.bank.findUnique({
    where: { organizationId_slug: { organizationId, slug } },
    select: { name: true },
  });
  const name = existing?.name ?? enteredName;
  return {
    ok: false,
    error: `A bank called “${name}” already exists.`,
    fieldErrors: { name: `A bank called “${name}” already exists.` },
  };
}

const create = safeAction(
  async (
    { organizationId },
    raw: unknown,
  ): Promise<ActionResult<SavedBank>> => {
    const parsed = bankInput.safeParse(raw);
    if (!parsed.success) return invalidInput(parsed.error.issues);
    const input = parsed.data;
    const slug = bankSlug(input.name);

    const { _max } = await db.bank.aggregate({
      where: { organizationId },
      _max: { sortOrder: true },
    });

    try {
      const bank = await db.bank.create({
        data: {
          organizationId,
          name: input.name,
          shortName: resolveShortName(input),
          slug,
          status: input.active ? "ACTIVE" : "INACTIVE",
          sortOrder: (_max.sortOrder ?? -1) + 1, // new banks go last
        },
        select: { id: true, name: true },
      });
      revalidateBankPages();
      return { ok: true, data: bank };
    } catch (error) {
      if (isPrismaError(error, "P2002"))
        return duplicateName(organizationId, slug, input.name);
      throw error;
    }
  },
);

const update = safeAction(
  async (
    { organizationId },
    id: unknown,
    raw: unknown,
  ): Promise<ActionResult<SavedBank>> => {
    if (typeof id !== "string") return { ok: false, error: NOT_FOUND };
    const parsed = bankInput.safeParse(raw);
    if (!parsed.success) return invalidInput(parsed.error.issues);
    const input = parsed.data;
    const slug = bankSlug(input.name);

    try {
      const bank = await db.bank.update({
        where: { id, organizationId },
        data: {
          name: input.name,
          shortName: resolveShortName(input),
          slug,
          status: input.active ? "ACTIVE" : "INACTIVE",
        },
        select: { id: true, name: true },
      });
      revalidateBankPages();
      return { ok: true, data: bank };
    } catch (error) {
      if (isPrismaError(error, "P2002"))
        return duplicateName(organizationId, slug, input.name);
      if (isPrismaError(error, "P2025")) return { ok: false, error: NOT_FOUND };
      throw error;
    }
  },
);

// Exported as plain async functions: a "use server" file may only export those.
export async function createBank(input: unknown) {
  return create(input);
}

export async function updateBank(id: unknown, input: unknown) {
  return update(id, input);
}

const HAS_HISTORY = "Deactivate this bank instead. It has rate history.";

const statusInput = z.enum(["ACTIVE", "INACTIVE"]);

const setStatus = safeAction(
  async (
    { organizationId },
    id: unknown,
    status: unknown,
  ): Promise<ActionResult<SavedBank & { status: "ACTIVE" | "INACTIVE" }>> => {
    const parsed = statusInput.safeParse(status);
    if (typeof id !== "string" || !parsed.success)
      return { ok: false, error: NOT_FOUND };
    try {
      const bank = await db.bank.update({
        where: { id, organizationId },
        data: { status: parsed.data },
        select: { id: true, name: true },
      });
      revalidateBankPages();
      return { ok: true, data: { ...bank, status: parsed.data } };
    } catch (error) {
      if (isPrismaError(error, "P2025")) return { ok: false, error: NOT_FOUND };
      throw error;
    }
  },
);

// Hard delete, only for a bank with no POF rates: with no rates it can't be
// in any board snapshot. The server re-checks inside the transaction, so a
// direct call can't bypass the disabled button; the Restrict foreign key
// (P2003) covers a rate inserted between the check and the delete.
const remove = safeAction(
  async ({ organizationId }, id: unknown): Promise<ActionResult<SavedBank>> => {
    if (typeof id !== "string") return { ok: false, error: NOT_FOUND };
    try {
      const result = await db.$transaction(async (tx) => {
        const bank = await tx.bank.findFirst({
          where: { id, organizationId },
          select: {
            id: true,
            name: true,
            _count: { select: { pofRates: true } },
          },
        });
        if (!bank) return { ok: false as const, error: NOT_FOUND };
        if (bank._count.pofRates > 0)
          return { ok: false as const, error: HAS_HISTORY };
        await tx.bank.delete({ where: { id, organizationId } });
        return { ok: true as const, data: { id: bank.id, name: bank.name } };
      });
      if (result.ok) revalidateBankPages();
      return result;
    } catch (error) {
      if (isPrismaError(error, "P2003"))
        return { ok: false, error: HAS_HISTORY };
      if (isPrismaError(error, "P2025")) return { ok: false, error: NOT_FOUND };
      throw error;
    }
  },
);

export async function setBankStatus(id: unknown, status: unknown) {
  return setStatus(id, status);
}

export async function deleteBank(id: unknown) {
  return remove(id);
}
