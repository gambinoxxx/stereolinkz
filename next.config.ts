import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Load these from node_modules at runtime instead of bundling them:
  // resvg is a native module, and Satori's harfbuzzjs dependency reads
  // hb.wasm from its own folder (bundling rewrites that path and breaks it).
  serverExternalPackages: ["@resvg/resvg-js", "satori"],
  // Satori reads the Archivo WOFF files from disk, so they must ship with
  // every route that renders a board: server actions on admin pages
  // (generate, regenerate: Phase 7 and 8) and the PNG download route.
  outputFileTracingIncludes: {
    "/admin/**": ["./assets/fonts/**/*"],
    "/api/boards/**": ["./assets/fonts/**/*"],
  },
  // The landing page shows the latest board PNGs from Vercel Blob through
  // next/image (resized for the phone screens). Board images only; logos
  // and flags stay unoptimized and need no entry.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/boards/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Logos are up to 1 MB; the default 1 MB limit would leave no room
      // for the other form fields and the multipart overhead.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
