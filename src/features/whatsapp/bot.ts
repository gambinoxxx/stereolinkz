// The WhatsApp bot's decisions and replies, pure (no network, no database)
// so the routing, the pause and the deal check can be tested. handle.ts
// runs them with real data. Short, friendly replies; never crypto.
import { normalizeRef } from "@/features/deals/refs";
import { STATUS_WORDS } from "@/features/whatsapp/status-words";
import { sameNumber } from "@/features/whatsapp/phone";
import type { DealStatus } from "@/generated/prisma/enums";

export type Button = { id: string; title: string }; // title ≤ 20 characters
export type Row = { id: string; title: string; description?: string }; // title ≤ 24

export type Reply =
  | { kind: "text"; body: string }
  | { kind: "buttons"; body: string; buttons: Button[] } // at most 3
  | { kind: "list"; body: string; button: string; rows: Row[] }; // at most 10

export type Contact = {
  isNew: boolean;
  state: string | null;
  stateAt: Date | null;
  pausedUntil: Date | null;
};

export type Incoming = { text: string | null; choice: string | null };

export const PAUSE_MS = 12 * 60 * 60_000;
export const STATE_TTL_MS = 30 * 60_000;
export const AWAITING_REFERENCE = "awaiting_reference";

// The services in the menu, and the deal form each one opens.
export const SERVICES = {
  "school-fees": {
    title: "School fees",
    form: "school-fees",
    query: "",
    line: "We pay the school directly and send you the confirmation.",
    needs: "You’ll need the school’s invoice or payment letter.",
  },
  "pay-abroad": {
    title: "International payment",
    form: "pay-abroad",
    query: "",
    line: "We pay suppliers, rent or bills abroad. You pay in naira; they receive in their currency.",
    needs: "Have the payment details ready. An invoice helps, if you have one.",
  },
  pof: {
    title: "Proof of funds (POF)",
    form: "pof",
    query: "",
    line: "A bank statement showing the funds for your visa, school or travel application.",
    needs: "Tell us the amount, the bank, how many months and the purpose.",
  },
  sell: {
    title: "Sell forex",
    form: "forex",
    query: "?dir=sell",
    line: "Send foreign currency from your banking app and receive naira.",
    needs: "Have the bank account for your naira ready.",
  },
  buy: {
    title: "Buy forex",
    form: "forex",
    query: "?dir=buy",
    line: "Buy foreign currency from us at today’s rate.",
    needs: "Tell us the currency and amount you need.",
  },
} as const;
export type ServiceKey = keyof typeof SERVICES;

export type Intent =
  | { intent: "silent" } // a person is handling this chat
  | { intent: "menu"; resume: boolean }
  | { intent: "service"; service: ServiceKey }
  | { intent: "rates" }
  | { intent: "track-ask" }
  | { intent: "track-lookup"; ref: string }
  | { intent: "track-invalid" }
  | { intent: "person" }
  | { intent: "unknown" };

const GREETINGS = new Set([
  "menu",
  "hi",
  "hello",
  "hey",
  "start",
  "good morning",
  "good afternoon",
  "good evening",
]);

// "slz 1047" → "SLZ-1047".
export function refFrom(text: string): string | null {
  return normalizeRef(text.trim().replace(/\s+/g, "-"));
}

export function decide(input: Incoming, contact: Contact, now: Date): Intent {
  const text =
    input.text
      ?.trim()
      .toLowerCase()
      .replace(/[!.?]+$/, "") ?? "";
  const paused = !!contact.pausedUntil && contact.pausedUntil > now;

  // "menu" (or a greeting) always works, and ends a pause early.
  if (input.choice === "menu" || GREETINGS.has(text))
    return { intent: "menu", resume: paused };
  if (paused) return { intent: "silent" };
  if (contact.isNew) return { intent: "menu", resume: false };

  if (input.choice) {
    if (input.choice.startsWith("svc:")) {
      const key = input.choice.slice(4);
      if (key in SERVICES)
        return { intent: "service", service: key as ServiceKey };
    }
    if (input.choice === "rates") return { intent: "rates" };
    if (input.choice === "track") return { intent: "track-ask" };
    if (input.choice === "person") return { intent: "person" };
    return { intent: "unknown" };
  }

  const awaiting =
    contact.state === AWAITING_REFERENCE &&
    !!contact.stateAt &&
    now.getTime() - contact.stateAt.getTime() < STATE_TTL_MS;
  const ref = input.text ? refFrom(input.text) : null;
  if (ref) return { intent: "track-lookup", ref };
  if (awaiting && input.text) return { intent: "track-invalid" };

  if (/\brates?\b/.test(text)) return { intent: "rates" };
  if (/\b(track|status)\b/.test(text)) return { intent: "track-ask" };
  if (/\b(person|human|agent|someone|staff)\b/.test(text))
    return { intent: "person" };
  return { intent: "unknown" };
}

// ── Replies ───────────────────────────────────────────────────────────

const MENU_BUTTON: Button = { id: "menu", title: "Menu" };
const AFTER_SERVICE: Button[] = [
  { id: "rates", title: "Today’s rates" },
  { id: "person", title: "Talk to a person" },
  MENU_BUTTON,
];

export function menuReply(brand: string, name: string | null): Reply {
  return {
    kind: "list",
    body: `Hello${name ? ` ${name.split(/\s+/)[0]}` : ""}, welcome to ${brand}. How can we help you today?`,
    button: "See options",
    rows: [
      { id: "svc:school-fees", title: "School fees" },
      { id: "svc:pay-abroad", title: "International payment" },
      { id: "svc:pof", title: "Proof of funds (POF)" },
      { id: "svc:sell", title: "Sell forex" },
      { id: "svc:buy", title: "Buy forex" },
      { id: "rates", title: "Today’s rates" },
      { id: "track", title: "Track my deal" },
      { id: "person", title: "Talk to a person" },
    ],
  };
}

export function serviceReply(
  key: ServiceKey,
  origin: string,
  available: boolean,
): Reply {
  const s = SERVICES[key];
  const how = available
    ? `Start here: ${origin}/deal/new/${s.form}${s.query}`
    : "We’re taking these requests here on WhatsApp right now. Tap “Talk to a person”.";
  return {
    kind: "buttons",
    body: `${s.title}: ${s.line}\n\n${s.needs}\n\n${how}`,
    buttons: AFTER_SERVICE,
  };
}

export type RatesView = {
  forex: {
    timeLabel: string;
    rows: { code: string; buy: string; sell: string }[];
  } | null;
  pof: { rows: { name: string; rate: string }[] } | null;
};

// Today's rates from the latest boards only. Never invents a rate.
export function ratesReply(
  view: RatesView,
  format: { naira: (v: string) => string; pct: (v: string) => string },
): Reply {
  const lines: string[] = [];
  if (view.forex?.rows.length) {
    lines.push(`Today’s rates (${view.forex.timeLabel})`, "");
    for (const r of view.forex.rows)
      lines.push(
        `${r.code}: we buy ${format.naira(r.buy)} · we sell ${format.naira(r.sell)}`,
      );
  }
  if (view.pof?.rows.length) {
    if (lines.length) lines.push("");
    lines.push("Proof of funds (per month)");
    for (const r of view.pof.rows)
      lines.push(`${r.name}: ${format.pct(r.rate)}%`);
  }
  if (!lines.length)
    return {
      kind: "buttons",
      body: "Today’s rates aren’t posted yet. A team member will confirm your rate here.",
      buttons: [{ id: "person", title: "Talk to a person" }, MENU_BUTTON],
    };
  lines.push("", "Your final rate is confirmed before you pay anything.");
  return {
    kind: "buttons",
    body: lines.join("\n"),
    buttons: [{ id: "person", title: "Talk to a person" }, MENU_BUTTON],
  };
}

export const trackAskReply: Reply = {
  kind: "text",
  body: "Please send your deal number. It looks like SLZ-1047 and it’s on your deal page.",
};

export const trackInvalidReply: Reply = {
  kind: "buttons",
  body: "That doesn’t look like a deal number. It looks like SLZ-1047. Send it again, or tap Menu.",
  buttons: [MENU_BUTTON],
};

// Only the deal's own WhatsApp number sees its status; anyone else gets
// the same reply as a deal that doesn't exist.
export function dealReply(
  waId: string,
  ref: string,
  deal: { customerWhatsapp: string; status: DealStatus } | null,
): Reply {
  if (!deal || !sameNumber(waId, deal.customerWhatsapp))
    return {
      kind: "buttons",
      body: `Please check your deal link. We couldn’t match ${ref} to this WhatsApp number.`,
      buttons: [{ id: "person", title: "Talk to a person" }, MENU_BUTTON],
    };
  return {
    kind: "buttons",
    body: `Deal ${ref}: ${STATUS_WORDS[deal.status]}.`,
    buttons: [{ id: "person", title: "Talk to a person" }, MENU_BUTTON],
  };
}

export const personReply: Reply = {
  kind: "text",
  body: "A team member will reply here shortly (Mon–Sat, 9am–6pm).",
};

export const unknownReply: Reply = {
  kind: "buttons",
  body: "Sorry, I didn’t get that. Tap Menu to see how we can help.",
  buttons: [MENU_BUTTON],
};
