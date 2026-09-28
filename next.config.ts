import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Load these from node_modules at runtime instead of bundling them:
  // resvg is a native module, and Satori's harfbuzzjs dependency reads
  // hb.wasm from its own folder (bundling rewrites that path and breaks it).
  serverExternalPackages: ["@resvg/resvg-js", "satori"],
  // Satori reads the Archivo WOFF files from disk, so they must ship with
  // every route that renders a board.
  outputFileTracingIncludes: {
    "/api/dev/render-spike": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
