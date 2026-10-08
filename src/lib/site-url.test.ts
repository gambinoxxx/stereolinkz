import { afterEach, describe, expect, it, vi } from "vitest";

import { siteUrl } from "@/lib/site-url";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://stereolinkz.example");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "app.vercel.app");
    expect(siteUrl().href).toBe("https://stereolinkz.example/");
  });

  it("falls back to the Vercel production domain, then localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "app.vercel.app");
    expect(siteUrl().href).toBe("https://app.vercel.app/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl().href).toBe("http://localhost:3000/");
  });
});
