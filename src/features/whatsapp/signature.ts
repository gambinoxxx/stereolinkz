// Meta's webhook checks (WhatsApp Cloud API), pure so they can be tested.
import { createHmac, timingSafeEqual } from "node:crypto";

// X-Hub-Signature-256: "sha256=<hex HMAC-SHA256 of the raw body, keyed with
// the app secret>". Compared in constant time; anything malformed is false.
export function verifySignature(
  rawBody: Uint8Array,
  header: string | null,
  appSecret: string | undefined,
): boolean {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const given = header.slice("sha256=".length);
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(given, "hex"));
}

// GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=… → the challenge
// when the token is ours, else null (403).
export function verifyChallenge(
  params: URLSearchParams,
  verifyToken: string | undefined,
): string | null {
  if (!verifyToken) return null;
  const token = params.get("hub.verify_token") ?? "";
  const ok =
    params.get("hub.mode") === "subscribe" &&
    token.length === verifyToken.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(verifyToken));
  return ok ? (params.get("hub.challenge") ?? null) : null;
}
