import { beforeEach, describe, expect, it, vi } from "vitest";

// hashIp (the rate limit key) needs a secret; a throwaway one for the test.
process.env.DEAL_SECRET = "test-secret-for-referral-link-tests-0123";

const findUnique = vi.fn();
vi.mock("@/lib/server/db", () => ({
  db: { referralCode: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
vi.mock("@/features/deals/public-queries", () => ({
  getDealDeskContext: async () => ({ org: { id: "org1" } }),
}));

const { GET } = await import("@/app/r/[code]/route");

const open = (code: string, ip = "198.51.100.7") =>
  GET(
    new Request(`https://stereolinkz.com/r/${code}`, {
      headers: { "x-forwarded-for": ip },
    }),
    { params: Promise.resolve({ code }) } as never,
  );

describe("/r/[code]", () => {
  beforeEach(() => findUnique.mockReset());

  it("keeps an active code in an httpOnly cookie for 60 days and goes to Start a deal", async () => {
    findUnique.mockResolvedValue({ active: true });
    const res = await open("slz7kq4m");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://stereolinkz.com/deal/new",
    );
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^slz_ref=SLZ7KQ4M;/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=5184000/);
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_code: { organizationId: "org1", code: "SLZ7KQ4M" },
      },
      select: { active: true },
    });
  });

  it("redirects the same way, with no cookie, for an unknown, inactive or malformed code", async () => {
    findUnique.mockResolvedValue(null);
    for (const res of [await open("NOPE1234"), await open("x!")]) {
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe(
        "https://stereolinkz.com/deal/new",
      );
      expect(res.headers.get("set-cookie")).toBeNull();
    }
    findUnique.mockResolvedValue({ active: false });
    expect((await open("OLDCODE1")).headers.get("set-cookie")).toBeNull();
  });

  it("stops setting cookies after 30 opens a minute from one address", async () => {
    findUnique.mockResolvedValue({ active: true });
    for (let i = 0; i < 30; i++) await open("SLZ7KQ4M", "203.0.113.9");
    const res = await open("SLZ7KQ4M", "203.0.113.9");
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
