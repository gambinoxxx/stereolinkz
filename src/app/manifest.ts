import type { MetadataRoute } from "next";

// The installable app (Home Screen on iPhone, Android, desktop): it opens
// on the admin, standalone (no browser bar), which iOS needs for web push.
// The service worker (public/sw.js) is registered only by signed-in admin
// pages; the public site gets nothing but this manifest link.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "Stereolinkz",
    short_name: "Stereolinkz",
    description: "Stereolinkz deal desk and rate boards",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#150730",
    theme_color: "#150730",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
