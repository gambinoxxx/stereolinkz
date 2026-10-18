import { describe, expect, it } from "vitest";

import { loginUrlFor } from "@/lib/path-header";

describe("loginUrlFor", () => {
  it("returns to the admin page that was opened", () => {
    expect(loginUrlFor("/admin/deals/SLZ-1009")).toBe(
      "/login?redirect_url=%2Fadmin%2Fdeals%2FSLZ-1009",
    );
    expect(loginUrlFor("/admin")).toBe("/login?redirect_url=%2Fadmin");
    expect(loginUrlFor("/admin/deals?status=PAID_OUT")).toBe(
      "/login?redirect_url=%2Fadmin%2Fdeals%3Fstatus%3DPAID_OUT",
    );
  });

  it("never points anywhere but our admin pages", () => {
    for (const path of [
      null,
      "",
      "/",
      "/administrator",
      "//evil.example/admin",
      "https://evil.example/admin",
      "/deal/SLZ-1009",
    ])
      expect(loginUrlFor(path)).toBe("/login");
  });
});
