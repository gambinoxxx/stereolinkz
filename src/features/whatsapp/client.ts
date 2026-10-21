import "server-only";

// Sending through the WhatsApp Cloud API (Meta, direct):
// POST graph.facebook.com/{version}/{phoneNumberId}/messages. Free-form
// messages only, so only in reply to a customer (inside their 24-hour
// window). Never logs the token, the number or the text: a failure logs
// the HTTP status and Meta's error code only.
import type { Button, Reply, Row } from "@/features/whatsapp/bot";

export function whatsappConfig() {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const version = process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v25.0";
  return token && phoneNumberId ? { token, phoneNumberId, version } : null;
}

// The message id Meta gives back, or null if nothing was sent.
async function post(payload: Record<string, unknown>): Promise<string | null> {
  const config = whatsappConfig();
  if (!config) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { code?: number; error_subcode?: number };
    };
    if (!res.ok) {
      console.error(
        `[whatsapp] send failed: HTTP ${res.status}, code ${body.error?.code ?? "?"}/${body.error?.error_subcode ?? "-"}`,
      );
      return null;
    }
    return body.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error(
      `[whatsapp] send failed: ${error instanceof Error ? error.name : "error"}`,
    );
    return null;
  }
}

const cut = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

export function sendText(to: string, body: string) {
  return post({
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: cut(body, 4096), preview_url: true },
  });
}

export function sendButtons(to: string, body: string, buttons: Button[]) {
  return post({
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: cut(body, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: cut(b.title, 20) },
        })),
      },
    },
  });
}

export function sendList(
  to: string,
  body: string,
  button: string,
  rows: Row[],
) {
  return post({
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: cut(body, 1024) },
      action: {
        button: cut(button, 20),
        sections: [
          {
            title: "Options",
            rows: rows.slice(0, 10).map((r) => ({
              id: r.id,
              title: cut(r.title, 24),
              ...(r.description && { description: cut(r.description, 72) }),
            })),
          },
        ],
      },
    },
  });
}

export function markAsRead(messageId: string) {
  return post({ status: "read", message_id: messageId });
}

export function sendReply(to: string, reply: Reply) {
  switch (reply.kind) {
    case "text":
      return sendText(to, reply.body);
    case "buttons":
      return sendButtons(to, reply.body, reply.buttons);
    case "list":
      return sendList(to, reply.body, reply.button, reply.rows);
  }
}
