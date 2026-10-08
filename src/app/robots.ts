import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

// The landing page is public; the admin app and the API are not for
// search engines (they also require sign-in).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
