import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  AWAITING_REFERENCE,
  type Contact,
  dealReply,
  decide,
  menuReply,
  PAUSE_MS,
  personReply,
  ratesReply,
  SERVICES,
  serviceReply,
  trackAskReply,
  unknownReply,
} from "@/features/whatsapp/bot";
import { parseWebhook } from "@/features/whatsapp/payload";
import { sameNumber } from "@/features/whatsapp/phone";
import {
  verifyChallenge,
  verifySignature,
} from "@/features/whatsapp/signature";
import { STATUS_WORDS } from "@/features/whatsapp/status-words";

const SECRET = "app-secret-for-tests";
const sign = (body: string, secret = SECRET) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const bytes = (s: string) => new TextEncoder().encode(s);

describe("webhook signature", () => {
  const body = '{"object":"whatsapp_business_account","entry":[]}';
  it("accepts Meta's HMAC of the raw body", () => {
    expect(verifySignature(bytes(body), sign(body), SECRET)).toBe(true);
  });
  it("refuses a changed body, another secret, a bad header or no secret", () => {
    expect(verifySignature(bytes(body + " "), sign(body), SECRET)).toBe(false);
    expect(verifySignature(bytes(body), sign(body, "other"), SECRET)).toBe(
      false,
    );
    expect(verifySignature(bytes(body), null, SECRET)).toBe(false);
    expect(verifySignature(bytes(body), "sha256=zz", SECRET)).toBe(false);
    expect(
      verifySignature(
        bytes(body),
        sign(body).replace("sha256=", "sha1="),
        SECRET,
      ),
    ).toBe(false);
    expect(verifySignature(bytes(body), sign(body), undefined)).toBe(false);
  });
});

describe("webhook verification (GET)", () => {
  const q = (s: string) => new URLSearchParams(s);
  it("echoes the challenge for our token", () => {
    expect(
      verifyChallenge(
        q("hub.mode=subscribe&hub.verify_token=abc123&hub.challenge=42"),
        "abc123",
      ),
    ).toBe("42");
  });
  it("refuses a wrong token, a wrong mode or no token set", () => {
    expect(
      verifyChallenge(
        q("hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42"),
        "abc123",
      ),
    ).toBeNull();
    expect(
      verifyChallenge(
        q("hub.mode=unsubscribe&hub.verify_token=abc123&hub.challenge=42"),
        "abc123",
      ),
    ).toBeNull();
    expect(
      verifyChallenge(
        q("hub.mode=subscribe&hub.verify_token=abc123&hub.challenge=42"),
        undefined,
      ),
    ).toBeNull();
  });
});

describe("payload", () => {
  it("reads text, list and button replies, and business-app echoes", () => {
    const { messages, echoes } = parseWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [
                  { wa_id: "2348031234567", profile: { name: "Ada Obi" } },
                ],
                messages: [
                  {
                    id: "w1",
                    from: "2348031234567",
                    type: "text",
                    text: { body: "hi" },
                  },
                  {
                    id: "w2",
                    from: "2348031234567",
                    type: "interactive",
                    interactive: {
                      type: "list_reply",
                      list_reply: { id: "rates" },
                    },
                  },
                  {
                    id: "w3",
                    from: "2348031234567",
                    type: "interactive",
                    interactive: {
                      type: "button_reply",
                      button_reply: { id: "menu" },
                    },
                  },
                ],
                message_echoes: [
                  { id: "e1", from: "2348000000000", to: "2348031234567" },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(messages.map((m) => [m.id, m.text, m.choice])).toEqual([
      ["w1", "hi", null],
      ["w2", null, "rates"],
      ["w3", null, "menu"],
    ]);
    expect(messages[0]!.name).toBe("Ada Obi");
    expect(echoes).toEqual([{ id: "e1", to: "2348031234567" }]);
  });
  it("ignores anything that isn't a WhatsApp business payload", () => {
    expect(parseWebhook({ object: "page" })).toEqual({
      messages: [],
      echoes: [],
    });
    expect(parseWebhook(null)).toEqual({ messages: [], echoes: [] });
  });
});

const now = new Date("2026-10-21T10:00:00Z");
const known: Contact = {
  isNew: false,
  state: null,
  stateAt: null,
  pausedUntil: null,
};
const say = (text: string, c: Contact = known) =>
  decide({ text, choice: null }, c, now);
const tap = (choice: string, c: Contact = known) =>
  decide({ text: null, choice }, c, now);

describe("menu routing", () => {
  it("greets a first message and menu words with the list", () => {
    expect(
      decide(
        { text: "good day", choice: null },
        { ...known, isNew: true },
        now,
      ),
    ).toEqual({ intent: "menu", resume: false });
    for (const w of ["menu", "Hi", "HELLO!", "hey"])
      expect(say(w).intent).toBe("menu");
  });
  it("routes every list option", () => {
    expect(tap("svc:school-fees")).toEqual({
      intent: "service",
      service: "school-fees",
    });
    expect(tap("svc:pof")).toEqual({ intent: "service", service: "pof" });
    expect(tap("svc:sell")).toEqual({ intent: "service", service: "sell" });
    expect(tap("rates").intent).toBe("rates");
    expect(tap("track").intent).toBe("track-ask");
    expect(tap("person").intent).toBe("person");
    expect(tap("svc:nonsense").intent).toBe("unknown");
  });
  it("understands a few words and deal numbers", () => {
    expect(say("what are your rates today").intent).toBe("rates");
    expect(say("I want to track my deal").intent).toBe("track-ask");
    expect(say("can I talk to a person").intent).toBe("person");
    expect(say("slz 1047")).toEqual({
      intent: "track-lookup",
      ref: "SLZ-1047",
    });
    expect(say("blah blah").intent).toBe("unknown");
  });
  it("waits for a deal number after Track my deal, for 30 minutes", () => {
    const waiting = {
      ...known,
      state: AWAITING_REFERENCE,
      stateAt: new Date(now.getTime() - 60_000),
    };
    expect(say("SLZ-1047", waiting)).toEqual({
      intent: "track-lookup",
      ref: "SLZ-1047",
    });
    expect(say("not sure", waiting).intent).toBe("track-invalid");
    const stale = {
      ...waiting,
      stateAt: new Date(now.getTime() - 31 * 60_000),
    };
    expect(say("not sure", stale).intent).toBe("unknown");
  });
  it("links each service to its existing deal form", () => {
    for (const key of Object.keys(SERVICES) as (keyof typeof SERVICES)[]) {
      const r = serviceReply(key, "https://stereolinkz.com", true);
      expect(r.kind === "buttons" && r.body).toMatch(
        /https:\/\/stereolinkz\.com\/deal\/new\/(school-fees|pay-abroad|pof|forex)/,
      );
      expect(r.kind === "buttons" && r.buttons.map((b) => b.id)).toEqual([
        "rates",
        "person",
        "menu",
      ]);
    }
    expect(serviceReply("sell", "https://x", true)).toMatchObject({
      body: expect.stringContaining("/deal/new/forex?dir=sell"),
    });
    expect(serviceReply("pof", "https://x", false)).toMatchObject({
      body: expect.not.stringContaining("/deal/new"),
    });
  });
});

describe("pause and resume", () => {
  const paused = { ...known, pausedUntil: new Date(now.getTime() + PAUSE_MS) };
  it("stays quiet while a person is handling the chat", () => {
    expect(say("hello?? anyone", paused).intent).toBe("silent");
    expect(tap("rates", paused).intent).toBe("silent");
    expect(say("SLZ-1047", paused).intent).toBe("silent");
  });
  it("resumes early when the customer types menu", () => {
    expect(say("menu", paused)).toEqual({ intent: "menu", resume: true });
    expect(tap("menu", paused)).toEqual({ intent: "menu", resume: true });
  });
  it("resumes by itself after the pause", () => {
    expect(
      say("rates", { ...known, pausedUntil: new Date(now.getTime() - 1) })
        .intent,
    ).toBe("rates");
  });
});

describe("deal lookup", () => {
  const deal = {
    customerWhatsapp: "+234 803 123 4567",
    status: "AWAITING_PAYMENT" as const,
  };
  it("shows the status only to the deal's own number", () => {
    expect(dealReply("2348031234567", "SLZ-1047", deal)).toMatchObject({
      body: "Deal SLZ-1047: Waiting for your payment.",
    });
  });
  it("tells anyone else to check their deal link, like a missing deal", () => {
    const other = dealReply("2348099999999", "SLZ-1047", deal);
    const missing = dealReply("2348031234567", "SLZ-1047", null);
    expect(other).toEqual(missing);
    expect(other.body).toContain("Please check your deal link");
    expect(other.body).not.toContain("Waiting");
  });
  it("matches numbers by their digits", () => {
    expect(sameNumber("2348031234567", "+234 803 123 4567")).toBe(true);
    expect(sameNumber("2348031234567", "+234 803 123 4568")).toBe(false);
    expect(sameNumber("", "")).toBe(false);
  });
  it("uses the plain words asked for", () => {
    expect(STATUS_WORDS.PAYMENT_RECEIVED).toBe("Payment received");
    expect(STATUS_WORDS.PROCESSING).toBe("Being processed");
    expect(STATUS_WORDS.COMPLETED).toBe("Completed");
    expect(STATUS_WORDS.CANCELLED).toBe("Cancelled");
  });
});

describe("rates", () => {
  const f = { naira: (v: string) => `₦${v}`, pct: (v: string) => v };
  it("lists the latest board's rates", () => {
    const r = ratesReply(
      {
        forex: {
          timeLabel: "Fri 16 Oct, 10:27 AM",
          rows: [{ code: "USD", buy: "1350", sell: "1375" }],
        },
        pof: { rows: [{ name: "Wema", rate: "3.4" }] },
      },
      f,
    );
    expect(r.body).toContain("USD: we buy ₦1350 · we sell ₦1375");
    expect(r.body).toContain("Wema: 3.4%");
  });
  it("never invents a rate when none is posted", () => {
    const r = ratesReply({ forex: null, pof: null }, f);
    expect(r.body).toContain("A team member will confirm your rate");
    expect(r.body).not.toMatch(/₦\d/);
  });
});

describe("wording", () => {
  it("never mentions crypto", () => {
    const texts = [
      menuReply("Stereolinkz", "Ada"),
      ...Object.keys(SERVICES).map((k) =>
        serviceReply(k as keyof typeof SERVICES, "https://x", true),
      ),
      trackAskReply,
      personReply,
      unknownReply,
      ...Object.values(STATUS_WORDS).map((w) => ({ body: w })),
    ].map((r) => JSON.stringify(r));
    for (const t of texts)
      expect(t).not.toMatch(/crypto|bitcoin|btc|usdt|coin/i);
  });
  it("keeps list rows and buttons inside WhatsApp's limits", () => {
    const menu = menuReply("Stereolinkz", null);
    expect(
      menu.kind === "list" && menu.rows.every((r) => r.title.length <= 24),
    ).toBe(true);
    expect(menu.kind === "list" && menu.rows.length).toBe(8);
    const r = serviceReply("pof", "https://x", true);
    expect(
      r.kind === "buttons" && r.buttons.every((b) => b.title.length <= 20),
    ).toBe(true);
  });
});
