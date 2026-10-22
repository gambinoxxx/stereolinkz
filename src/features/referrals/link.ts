import "server-only";

// The referral cookie (stereolinkz.com/r/CODE or ?ref=CODE): first-party,
// httpOnly, 60 days, sameSite lax, secure on https. Set only for a code
// that exists and is active; the deal form reads it back through a public
// action, and creating a deal clears it. Never logged.
import {
  normalizeCode,
  REF_COOKIE,
  REF_COOKIE_DAYS,
} from "@/features/referrals/rules";
import type { NewDeal } from "@/features/deals/create";
import { checkCode } from "@/features/referrals/attach";
import { db } from "@/lib/server/db";
import { siteUrl } from "@/lib/site-url";

export const REF_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: siteUrl().protocol === "https:",
  path: "/",
  maxAge: REF_COOKIE_DAYS * 24 * 60 * 60,
};

// The code, uppercased, if it exists and is active; else null.
export async function activeCode(
  organizationId: string,
  raw: unknown,
): Promise<string | null> {
  const code = normalizeCode(raw);
  if (!code) return null;
  const row = await db.referralCode.findUnique({
    where: { organizationId_code: { organizationId, code } },
    select: { active: true },
  });
  return row?.active ? code : null;
}

// The referral that goes with a website deal. `typed`: the form's code
// (undefined when the form didn't show the field: no campaign, or a cached
// form); `cookie`: the link's cookie. An unknown or inactive TYPED code is
// the customer's field error. With no field, the cookie's code goes with
// the deal so its outcome is recorded rather than lost, and a bad one never
// blocks the deal (it's logged as skipped). A field the customer emptied
// means no code. The attribution rules run later, in createDeal.
export async function referralForSubmit(
  organizationId: string,
  typed: string | undefined,
  cookie: string | undefined,
): Promise<
  { ok: true; referral: NewDeal["referral"] } | { ok: false; error: string }
> {
  const fromCookie = typed === undefined;
  const check = await checkCode(organizationId, fromCookie ? cookie : typed);
  if (check.ok)
    return {
      ok: true,
      referral: check.code ? { code: check.code } : undefined,
    };
  return fromCookie
    ? {
        ok: true,
        referral: { skipped: { code: check.code, reason: check.reason } },
      }
    : { ok: false, error: check.error };
}

export { REF_COOKIE };
