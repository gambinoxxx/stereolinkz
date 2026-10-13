import "server-only";

// Customer access and bot checks for the deal desk (Invariant 14,
// code-standards → Deal Desk). Node crypto only; nothing here is logged.
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

// ── Tracking tokens ───────────────────────────────────────────────────
// 32 random bytes, base64url, sent once in the customer's link. Only the
// SHA-256 hash is stored, so a database leak gives no working links.

export function createTrackingToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// Constant-time: the comparison takes as long for a wrong token as for a
// right one. Tokens that aren't 43 base64url characters never match.
export function tokenMatches(
  token: string | null | undefined,
  storedHash: string,
): boolean {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Server secret ─────────────────────────────────────────────────────
// DEAL_SECRET keys the form timestamps and the IP hash. Without it the
// public actions refuse to run (fail closed), rather than use a guessable key.

export class MissingDealSecretError extends Error {}

function secret(): string {
  const value = process.env.DEAL_SECRET?.trim();
  if (!value || value.length < 32)
    throw new MissingDealSecretError("DEAL_SECRET is not set (32+ characters)");
  return value;
}

const hmac = (purpose: string, value: string) =>
  createHmac("sha256", secret())
    .update(`${purpose}:${value}`)
    .digest("base64url");

// ── Form timestamps ───────────────────────────────────────────────────
// Issued with the form ("<ms>.<signature>"), checked on submit: a submit
// faster than 3 s is a bot; a form older than a day must be reloaded.

export const MIN_FILL_MS = 3_000;
export const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;

export function issueFormToken(now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${hmac("form", ts)}`;
}

export type FormTokenCheck = "ok" | "invalid" | "too-fast" | "expired";

export function checkFormToken(
  token: string,
  now = Date.now(),
): FormTokenCheck {
  const [ts, sig, extra] = token.split(".");
  if (!ts || !sig || extra !== undefined || !/^\d{13}$/.test(ts))
    return "invalid";
  const expected = Buffer.from(hmac("form", ts));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return "invalid";
  const age = now - Number(ts);
  if (age < MIN_FILL_MS) return "too-fast";
  if (age > MAX_FORM_AGE_MS) return "expired";
  return "ok";
}

// ── IP hash ───────────────────────────────────────────────────────────
// For the per-IP rate limit only: keyed, so the stored value can't be
// reversed to an address by trying every IP.

export function hashIp(ip: string): string {
  return hmac("ip", ip.trim().toLowerCase());
}
