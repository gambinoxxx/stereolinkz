// The webhook payload (WhatsApp Cloud API), reduced to what the bot uses.
// Text is passed through for the reply and never stored.

export type Inbound = {
  id: string; // wamid
  from: string; // the customer's WhatsApp id (digits)
  type: string; // "text", "interactive", "image", …
  text: string | null; // typed text
  choice: string | null; // a list row or button id we sent
  name: string | null; // their WhatsApp profile name (not stored)
};

// A message the business sent from the WhatsApp Business app
// (coexistence): a person is handling that chat.
export type Echo = { id: string; to: string };

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v && typeof v === "object" ? (v as Json) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null =>
  typeof v === "string" && v ? v : null;

export function parseWebhook(body: unknown): {
  messages: Inbound[];
  echoes: Echo[];
} {
  const messages: Inbound[] = [];
  const echoes: Echo[] = [];
  const root = obj(body);
  if (root.object !== "whatsapp_business_account") return { messages, echoes };
  for (const entry of arr(root.entry))
    for (const change of arr(obj(entry).changes)) {
      const value = obj(obj(change).value);
      const names = new Map<string, string>();
      for (const c of arr(value.contacts)) {
        const waId = str(obj(c).wa_id);
        const name = str(obj(obj(c).profile).name);
        if (waId && name) names.set(waId, name);
      }
      for (const m of arr(value.messages)) {
        const msg = obj(m);
        const id = str(msg.id);
        const from = str(msg.from);
        const type = str(msg.type) ?? "unknown";
        if (!id || !from) continue;
        const interactive = obj(msg.interactive);
        const choice =
          str(obj(interactive.list_reply).id) ??
          str(obj(interactive.button_reply).id) ??
          str(obj(msg.button).payload);
        messages.push({
          id,
          from,
          type,
          text: type === "text" ? str(obj(msg.text).body) : null,
          choice,
          name: names.get(from) ?? null,
        });
      }
      // Coexistence: messages sent from the WhatsApp Business app.
      for (const e of arr(value.message_echoes)) {
        const echo = obj(e);
        const id = str(echo.id);
        const to = str(echo.to);
        if (id && to) echoes.push({ id, to });
      }
    }
  return { messages, echoes };
}
