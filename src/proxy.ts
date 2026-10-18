import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { PATH_HEADER } from "@/lib/path-header";

// Attaches the Clerk session to every request. It does not protect routes:
// access is checked next to the data (requireMember() in every admin
// layout, page query, server action and route handler). It also passes the
// requested path on, always overwritten so a client can't set it, so a
// signed-out visit to /admin/deals/SLZ-1009 can return there after sign-in.
export default clerkMiddleware((_auth, req) => {
  const headers = new Headers(req.headers);
  headers.set(PATH_HEADER, req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search
    // params. Also skip the public site: the landing page ("/" itself, via
    // .+), the deal pages (/deal/*), robots.txt and sitemap.xml read no
    // session, and running Clerk there would send first-time visitors
    // through its handshake redirect. API routes still run it (below).
    "/((?!_next|deal(?:/|$)|robots\\.txt$|sitemap\\.xml$|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).+)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
