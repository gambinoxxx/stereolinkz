import { clerkMiddleware } from "@clerk/nextjs/server";

// Attaches the Clerk session to every request. It does not protect routes:
// access is checked next to the data (requireMember() in every admin
// layout, page query, server action and route handler).
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search
    // params. Also skip the public site: the landing page ("/" itself, via
    // .+), robots.txt and sitemap.xml read no session, and running Clerk
    // there would send first-time visitors through its handshake redirect.
    "/((?!_next|robots\\.txt$|sitemap\\.xml$|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).+)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
