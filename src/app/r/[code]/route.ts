import { NextResponse } from "next/server";

import { getDealDeskContext } from "@/features/deals/public-queries";
import { hashIp } from "@/features/deals/security";
import {
  activeCode,
  REF_COOKIE,
  REF_COOKIE_OPTIONS,
} from "@/features/referrals/link";
import { createLimiter } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 30 link opens a minute per IP: plenty for a person, little for a script.
const allow = createLimiter(30, 60_000);

// stereolinkz.com/r/CODE: keeps a valid, active code in the referral
// cookie and goes to "Start a deal". Any other code (or too many tries)
// goes there too, with no cookie, so the link never says whether a code
// exists.
export async function GET(request: Request, ctx: RouteContext<"/r/[code]">) {
  const { code: raw } = await ctx.params;
  const res = NextResponse.redirect(new URL("/deal/new", request.url), 303);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  if (!allow(hashIp(ip))) return res;
  const ctxDesk = await getDealDeskContext();
  const code = ctxDesk ? await activeCode(ctxDesk.org.id, raw) : null;
  if (code) res.cookies.set(REF_COOKIE, code, REF_COOKIE_OPTIONS);
  return res;
}
