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

export { REF_COOKIE };
