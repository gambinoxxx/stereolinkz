import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

describe("the web app manifest", () => {
  it("is valid JSON for an installable, standalone app on the admin", () => {
    const m = JSON.parse(JSON.stringify(manifest()));
    expect(m).toMatchObject({
      name: "Stereolinkz",
      short_name: "Stereolinkz",
      start_url: "/admin",
      scope: "/",
      display: "standalone", // iOS web push needs standalone or fullscreen
      theme_color: "#150730",
      background_color: "#150730",
    });
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(
      m.icons.some((i: { purpose?: string }) => i.purpose === "maskable"),
    ).toBe(true);
  });
});
