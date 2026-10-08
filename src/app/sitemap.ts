import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

// One public page.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", siteUrl()).href,
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
