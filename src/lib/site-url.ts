// The public site's absolute URL, for metadataBase, robots.txt and
// sitemap.xml. NEXT_PUBLIC_SITE_URL in each environment; on Vercel the
// production domain is the fallback, then localhost in development.
// The website as printed on boards: "stereolinkz.com" (no scheme, no www).
// Null on localhost, so development boards don't print it.
export function boardWebsite(): string | null {
  const host = siteUrl().hostname.replace(/^www\./, "");
  return host === "localhost" || /^[\d.]+$/.test(host) ? null : host;
}

export function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return new URL(configured);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}
