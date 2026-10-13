import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkFormToken,
  createTrackingToken,
  hashIp,
  hashToken,
  issueFormToken,
  MissingDealSecretError,
  tokenMatches,
} from "@/features/deals/security";

beforeEach(() =>
  vi.stubEnv("DEAL_SECRET", "test-secret-test-secret-test-secret-123"),
);
afterEach(() => vi.unstubAllEnvs());

describe("tracking tokens", () => {
  it("are 32 random bytes in base64url, stored as a SHA-256 hash", () => {
    const { token, hash } = createTrackingToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });

  it("are different every time", () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => createTrackingToken().token),
    );
    expect(tokens.size).toBe(200);
  });

  it("match only their own deal", () => {
    const a = createTrackingToken();
    const b = createTrackingToken();
    expect(tokenMatches(a.token, a.hash)).toBe(true);
    expect(tokenMatches(b.token, a.hash)).toBe(false);
    expect(tokenMatches(null, a.hash)).toBe(false);
    expect(tokenMatches("", a.hash)).toBe(false);
    expect(tokenMatches(a.token.slice(0, -1), a.hash)).toBe(false);
    expect(tokenMatches(`${a.token}x`, a.hash)).toBe(false);
    expect(tokenMatches(a.hash, a.hash)).toBe(false);
  });
});

describe("form tokens", () => {
  const t0 = 1_791_900_000_000;

  it("pass after 3 seconds and within a day", () => {
    const token = issueFormToken(t0);
    expect(checkFormToken(token, t0 + 3_000)).toBe("ok");
    expect(checkFormToken(token, t0 + 23 * 3_600_000)).toBe("ok");
  });

  it("reject a too-fast submit", () => {
    expect(checkFormToken(issueFormToken(t0), t0 + 2_999)).toBe("too-fast");
    expect(checkFormToken(issueFormToken(t0), t0)).toBe("too-fast");
  });

  it("reject an old form", () => {
    expect(checkFormToken(issueFormToken(t0), t0 + 25 * 3_600_000)).toBe(
      "expired",
    );
  });

  it("reject a forged or edited timestamp", () => {
    const token = issueFormToken(t0);
    const [, sig] = token.split(".");
    expect(checkFormToken(`${t0 - 60_000}.${sig}`, t0 + 10_000)).toBe(
      "invalid",
    );
    expect(checkFormToken("1791899990000.forged", t0 + 10_000)).toBe("invalid");
    expect(checkFormToken("", t0)).toBe("invalid");
    expect(checkFormToken(`${token}.x`, t0 + 10_000)).toBe("invalid");
  });

  it("refuse to work without DEAL_SECRET", () => {
    vi.stubEnv("DEAL_SECRET", "");
    expect(() => issueFormToken(t0)).toThrow(MissingDealSecretError);
  });
});

describe("hashIp", () => {
  it("is stable, keyed and never the address itself", () => {
    expect(hashIp("102.89.1.1")).toBe(hashIp(" 102.89.1.1 "));
    expect(hashIp("102.89.1.1")).not.toBe(hashIp("102.89.1.2"));
    expect(hashIp("102.89.1.1")).not.toContain("102.89");
    const before = hashIp("102.89.1.1");
    vi.stubEnv("DEAL_SECRET", "another-secret-another-secret-another-1");
    expect(hashIp("102.89.1.1")).not.toBe(before);
  });
});
