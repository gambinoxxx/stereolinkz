"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getTemplate, isTemplateKey } from "@/features/templates/registry";
import type { TemplateType } from "@/features/templates/types";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";

const input = z.object({
  type: z.enum(["FOREX", "POF", "CRYPTO"]),
  key: z.string().min(1),
});

// The org's default template per board type (preselected in the generator).
const setDefault = safeAction(
  async (
    { organizationId },
    rawType: unknown,
    rawKey: unknown,
  ): Promise<ActionResult<{ name: string; type: TemplateType }>> => {
    const parsed = input.safeParse({ type: rawType, key: rawKey });
    if (!parsed.success || !isTemplateKey(parsed.data.key, parsed.data.type))
      return {
        ok: false,
        error: "That template isn't available. Refresh the page.",
      };
    const { type, key } = parsed.data;

    await db.organization.update({
      where: { id: organizationId },
      data: {
        FOREX: { defaultForexTemplateKey: key },
        POF: { defaultPofTemplateKey: key },
        CRYPTO: { defaultCryptoTemplateKey: key },
      }[type],
    });
    revalidatePath("/admin/templates");
    revalidatePath("/admin/generator");
    return { ok: true, data: { name: getTemplate(key).name, type } };
  },
);

// A "use server" file may only export async functions.
export async function setDefaultTemplate(type: TemplateType, key: string) {
  return setDefault(type, key);
}
