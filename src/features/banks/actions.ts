"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { bankInput, resolveShortName } from "@/features/banks/schema";
import { bankSlug } from "@/features/banks/slug";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { deleteBlob, uploadImage, validateImage } from "@/lib/server/blob";
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

// The same slug means the same bank ("Acme Bank" = "AcmeBank"). Name the
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

type BankForm = {
  input: unknown;
  logo: File | null;
  removeLogo: boolean;
};

// The drawer sends FormData: name, shortName, active ("true"/"false"), an
// optional logo file and removeLogo ("true" clears the logo).
function readBankForm(form: unknown): BankForm | null {
  if (!(form instanceof FormData)) return null;
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  const logo = form.get("logo");
  return {
    input: {
      name: text("name"),
      shortName: text("shortName"),
      active: text("active") === "true",
    },
    logo: logo instanceof File && logo.size > 0 ? logo : null,
    removeLogo: text("removeLogo") === "true",
  };
}

const logoPath = (organizationId: string, slug: string, ext: string) =>
  `logos/${organizationId}/banks/${slug}.${ext}`;

// Same order as the generate flow: validate everything, upload, write the
// row, and delete the new upload if the write fails. Replacing a logo keeps
// the old file: board snapshots may point at it.
async function saveBank(
  organizationId: string,
  id: string | null, // null = create
  form: unknown,
): Promise<ActionResult<SavedBank>> {
  const data = readBankForm(form);
  if (!data) return { ok: false, error: "Something went wrong. Try again." };
  const parsed = bankInput.safeParse(data.input);
  if (!parsed.success) return invalidInput(parsed.error.issues);
  const input = parsed.data;
  const slug = bankSlug(input.name);

  const image = data.logo ? await validateImage(data.logo) : null;
  if (image && !image.ok)
    return {
      ok: false,
      error: image.error,
      fieldErrors: { logo: image.error },
    };

  // Checked before uploading, so a duplicate name doesn't upload a file
  // for nothing. The unique index still decides (P2002 below).
  const clash = await db.bank.findFirst({
    where: { organizationId, slug, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) return duplicateName(organizationId, slug, input.name);

  const uploaded = image?.ok
    ? await uploadImage(image, logoPath(organizationId, slug, image.ext))
    : null;
  const logoUrl = uploaded ? uploaded.url : data.removeLogo ? null : undefined; // keep the current logo

  const fields = {
    name: input.name,
    shortName: resolveShortName(input),
    slug,
    status: input.active ? ("ACTIVE" as const) : ("INACTIVE" as const),
    ...(logoUrl !== undefined ? { logoUrl } : {}),
  };

  try {
    let bank: SavedBank;
    if (id) {
      bank = await db.bank.update({
        where: { id, organizationId },
        data: fields,
        select: { id: true, name: true },
      });
    } else {
      const { _max } = await db.bank.aggregate({
        where: { organizationId },
        _max: { sortOrder: true },
      });
      bank = await db.bank.create({
        data: {
          ...fields,
          organizationId,
          sortOrder: (_max.sortOrder ?? -1) + 1, // new banks go last
        },
        select: { id: true, name: true },
      });
    }
    revalidateBankPages();
    return { ok: true, data: bank };
  } catch (error) {
    if (uploaded) await deleteBlob(uploaded.url);
    if (isPrismaError(error, "P2002"))
      return duplicateName(organizationId, slug, input.name);
    if (isPrismaError(error, "P2025")) return { ok: false, error: NOT_FOUND };
    throw error;
  }
}

const create = safeAction(
  ({ organizationId }, form: unknown): Promise<ActionResult<SavedBank>> =>
    saveBank(organizationId, null, form),
);

const update = safeAction(
  async (
    { organizationId },
    id: unknown,
    form: unknown,
  ): Promise<ActionResult<SavedBank>> => {
    if (typeof id !== "string") return { ok: false, error: NOT_FOUND };
    return saveBank(organizationId, id, form);
  },
);

// Exported as plain async functions: a "use server" file may only export those.
export async function createBank(form: FormData) {
  return create(form);
}

export async function updateBank(id: string, form: FormData) {
  return update(id, form);
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
            logoUrl: true,
            _count: { select: { pofRates: true } },
          },
        });
        if (!bank) return { ok: false as const, error: NOT_FOUND };
        if (bank._count.pofRates > 0)
          return { ok: false as const, error: HAS_HISTORY };
        await tx.bank.delete({ where: { id, organizationId } });
        return {
          ok: true as const,
          data: { id: bank.id, name: bank.name },
          logoUrl: bank.logoUrl,
        };
      });
      if (!result.ok) return result;
      // With no rates the bank is in no snapshot, so its logo can go too
      // (after the row is gone, best effort).
      if (result.logoUrl) await deleteBlob(result.logoUrl);
      revalidateBankPages();
      return { ok: true, data: result.data };
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
