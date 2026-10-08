import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forexFixture } from "@/test/board-fixtures";

const findUnique = vi.fn();
const findFirst = vi.fn();
vi.mock("@/lib/server/db", () => ({
  db: {
    organization: { findUnique: (...a: unknown[]) => findUnique(...a) },
    rateBoard: { findFirst: (...a: unknown[]) => findFirst(...a) },
  },
}));

const { getPublicLanding } = await import("@/features/public/queries");

const ORG = {
  id: "org-1",
  name: "Stereolinkz",
  logoUrl: null,
  backgroundColor: "#2A0F58",
  primaryColor: "#6A35D9",
  accentColor: "#E9B949",
  contactLine: "+234 800 000 0000",
  email: null,
  timezone: "Africa/Lagos",
};

beforeEach(() => {
  vi.stubEnv("PUBLIC_ORG_SLUG", "stereolinkz");
  vi.stubEnv("PUBLIC_SHOW_POF", "true");
  findUnique.mockResolvedValue(ORG);
  findFirst.mockImplementation(({ where }: { where: { type: string } }) =>
    Promise.resolve(
      where.type === "FOREX"
        ? {
            id: "b1",
            snapshot: forexFixture(),
            snapshotVersion: 1,
            createdAt: new Date("2026-09-27T09:25:00Z"),
            images: [],
          }
        : null,
    ),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getPublicLanding", () => {
  it("reads the org by slug and one newest board per type", async () => {
    const landing = await getPublicLanding();
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "stereolinkz" } }),
    );
    const types = findFirst.mock.calls.map(([a]) => a.where.type).sort();
    expect(types).toEqual(["CRYPTO", "FOREX", "POF"]);
    for (const [args] of findFirst.mock.calls) {
      expect(args.where.organizationId).toBe("org-1");
      expect(args.orderBy[0]).toEqual({ createdAt: "desc" });
      expect(args.select.images.take).toBe(1);
      // Never the author or anything outside the snapshot and image.
      expect(Object.keys(args.select).sort()).toEqual([
        "createdAt",
        "id",
        "images",
        "snapshot",
        "snapshotVersion",
      ]);
    }
    expect(landing.forex?.rows.length).toBeGreaterThan(0);
    expect(landing.crypto).toBeNull();
    expect(landing.pof).toBeNull();
  });

  it("selects only public org fields and drops the id", async () => {
    const landing = await getPublicLanding();
    const select = findUnique.mock.calls[0]?.[0].select;
    expect(Object.keys(select).sort()).toEqual([
      "accentColor",
      "backgroundColor",
      "contactLine",
      "email",
      "id",
      "logoUrl",
      "name",
      "primaryColor",
      "timezone",
    ]);
    expect(landing.org).not.toHaveProperty("id");
  });

  it("skips POF unless PUBLIC_SHOW_POF is true", async () => {
    vi.stubEnv("PUBLIC_SHOW_POF", "false");
    await getPublicLanding();
    const types = findFirst.mock.calls.map(([a]) => a.where.type);
    expect(types).not.toContain("POF");
  });

  it("is empty when the slug is missing or unknown", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("PUBLIC_ORG_SLUG", "");
    expect(await getPublicLanding()).toEqual({
      org: null,
      forex: null,
      crypto: null,
      pof: null,
    });
    vi.stubEnv("PUBLIC_ORG_SLUG", "nobody");
    findUnique.mockResolvedValue(null);
    expect((await getPublicLanding()).org).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
