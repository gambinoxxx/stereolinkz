"use server";

import { revalidatePath } from "next/cache";

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
