import { after } from "next/server";

import { processWebhook } from "@/features/whatsapp/handle";
import {
  verifyChallenge,
  verifySignature,
} from "@/features/whatsapp/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const plain = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });

// Meta's subscription check: echo hub.challenge when the verify token is ours.
export async function GET(request: Request) {
  const challenge = verifyChallenge(
    new URL(request.url).searchParams,
    process.env.WHATSAPP_VERIFY_TOKEN?.trim(),
  );
  return challenge === null ? plain("Forbidden", 403) : plain(challenge, 200);
}

// WhatsApp messages (architecture.md → Invariants 7 and 14: no login here;
// Meta's signature is the check). The signature covers the raw bytes, so
// they're read before any parsing. 200 straight away; the bot runs after
// the response, so Meta never times out and retries.
export async function POST(request: Request) {
  const raw = new Uint8Array(await request.arrayBuffer());
  if (
    !verifySignature(
      raw,
      request.headers.get("x-hub-signature-256"),
      process.env.WHATSAPP_APP_SECRET?.trim(),
    )
  )
    return plain("Invalid signature", 401);
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return plain("Bad request", 400);
  }
  after(() =>
    processWebhook(body).catch((error) =>
      console.error(
        `[whatsapp] webhook failed: ${error instanceof Error ? error.name : "error"}`,
      ),
    ),
  );
  return plain("OK", 200);
}
