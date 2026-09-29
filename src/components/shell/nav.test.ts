import { describe, expect, it } from "vitest";

import { isActive } from "@/components/shell/nav";

describe("isActive", () => {
  it("matches the dashboard only on /admin", () => {
    expect(isActive("/admin", "/admin")).toBe(true);
    expect(isActive("/admin/forex", "/admin")).toBe(false);
  });

  it("matches a section and its sub-routes, not look-alikes", () => {
    expect(isActive("/admin/forex", "/admin/forex")).toBe(true);
    expect(isActive("/admin/forex/usd", "/admin/forex")).toBe(true);
    expect(isActive("/admin/forexx", "/admin/forex")).toBe(false);
    expect(isActive("/admin/dev-kit", "/admin/pof")).toBe(false);
  });
});
