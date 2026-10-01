"use server";

import { revalidatePath } from "next/cache";

import { orgSettingsInput } from "@/features/settings/schema";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { uploadImage, validateImage } from "@/lib/server/blob";
import { db } from "@/lib/server/db";

// Pages that read the organization's settings. Saved boards don't change:
// each keeps the brand copied into its snapshot (Invariants 3 and 5).
function revalidateSettingsPages() {
  for (const path of [
    "/admin",
    "/admin/settings",
    "/admin/generator",
    "/admin/templates",
  ])
    revalidatePath(path);
}

const FIELDS = [
  "name",
  "contactLine",
  "email",
  "backgroundColor",
  "primaryColor",
  "accentColor",
  "timezone",
  "defaultFinePrint",
] as const;

// Updates only the member's Organization row. Unchanged values write
// nothing ("No changes to save").
const update = safeAction(
  async (
    { organizationId },
    raw: unknown,
  ): Promise<ActionResult<{ changed: boolean }>> => {
    const parsed = orgSettingsInput.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
      return { ok: false, error: "Check the highlighted fields.", fieldErrors };
    }
    const input = parsed.data;

    const current = await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: Object.fromEntries(FIELDS.map((f) => [f, true])) as Record<
        (typeof FIELDS)[number],
        true
      >,
    });
    if (FIELDS.every((f) => current[f] === input[f]))
      return { ok: true, data: { changed: false } };

    await db.organization.update({
      where: { id: organizationId },
      data: input,
    });
    revalidateSettingsPages();
    return { ok: true, data: { changed: true } };
  },
);

// The logo is saved on its own, at once, so the preview updates straight
// away. Each upload gets a new path and the old file is kept: boards made
// earlier point at it (Invariant 12).
const uploadLogo = safeAction(
  async (
    { organizationId },
    form: unknown,
  ): Promise<ActionResult<{ logoUrl: string }>> => {
    const file = form instanceof FormData ? form.get("logo") : null;
    if (!(file instanceof File) || file.size === 0)
      return { ok: false, error: "Choose a logo file." };
    const image = await validateImage(file);
    if (!image.ok) return { ok: false, error: image.error };

    const { url } = await uploadImage(
      image,
      `orgs/${organizationId}/logo-${crypto.randomUUID()}.${image.ext}`,
      { randomSuffix: false },
    );
    await db.organization.update({
      where: { id: organizationId },
      data: { logoUrl: url },
    });
    revalidateSettingsPages();
    return { ok: true, data: { logoUrl: url } };
  },
);

// Boards fall back to the wordmark. The file stays in Blob for old boards.
const removeLogo = safeAction(
  async ({ organizationId }): Promise<ActionResult<null>> => {
    await db.organization.update({
      where: { id: organizationId },
      data: { logoUrl: null },
    });
    revalidateSettingsPages();
    return { ok: true, data: null };
  },
);

// A "use server" file may only export async functions.
export async function updateOrgSettings(input: unknown) {
  return update(input);
}

export async function uploadOrgLogo(form: FormData) {
  return uploadLogo(form);
}

export async function removeOrgLogo() {
  return removeLogo();
}
