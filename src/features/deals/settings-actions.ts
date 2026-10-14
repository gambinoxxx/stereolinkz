"use server";

import { revalidatePath } from "next/cache";

import {
  dealSettingsInput,
  paymentAccountInput,
} from "@/features/deals/settings-schema";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";

// The settings tab, and the public pages that list services or show an
// account (they render per request, but drop any cached copy too).
function revalidateDealSettings() {
  for (const path of [
    "/",
    "/admin/settings/deal-desk",
    "/admin/deals",
    "/deal/new",
  ])
    revalidatePath(path);
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    out[key] ??= issue.message;
  }
  return out;
}

const CHECK = "Please check the highlighted fields.";

export const updateDealSettings = safeAction(
  async (
    { organizationId },
    raw: unknown,
  ): Promise<ActionResult<{ saved: true }>> => {
    const parsed = dealSettingsInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    const value = parsed.data;

    // The default owner must belong to this organization.
    if (value.dealDefaultOwnerId) {
      const owner = await db.membership.findFirst({
        where: { id: value.dealDefaultOwnerId, organizationId },
        select: { id: true },
      });
      if (!owner)
        return {
          ok: false,
          error: CHECK,
          fieldErrors: { dealDefaultOwnerId: "Choose a team member." },
        };
    }

    await db.organization.update({
      where: { id: organizationId },
      data: {
        dealServicesEnabled: value.services,
        contactSlaMinutes: value.contactSlaMinutes,
        dealRefPrefix: value.dealRefPrefix,
        dealAlertEmails: value.dealAlertEmails,
        dealDefaultOwnerId: value.dealDefaultOwnerId,
      },
    });
    revalidateDealSettings();
    return { ok: true, data: { saved: true } };
  },
);

// Add (no id) or edit an account. Accounts are never deleted: deals keep
// pointing at the account they showed; inactive ones are just not offered.
export const savePaymentAccount = safeAction(
  async (
    { organizationId },
    raw: unknown,
  ): Promise<ActionResult<{ id: string }>> => {
    const parsed = paymentAccountInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    const { id, ...data } = parsed.data;

    if (id) {
      const { count } = await db.paymentAccount.updateMany({
        where: { id, organizationId },
        data,
      });
      if (count !== 1)
        return {
          ok: false,
          error: "That account no longer exists. Reload the page.",
        };
      revalidateDealSettings();
      return { ok: true, data: { id } };
    }

    const last = await db.paymentAccount.findFirst({
      where: { organizationId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const created = await db.paymentAccount.create({
      data: { ...data, organizationId, sortOrder: (last?.sortOrder ?? -1) + 1 },
      select: { id: true },
    });
    revalidateDealSettings();
    return { ok: true, data: { id: created.id } };
  },
);
