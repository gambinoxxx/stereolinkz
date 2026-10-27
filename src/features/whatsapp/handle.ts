import "server-only";

// Runs the WhatsApp bot for a verified webhook payload (after the 200 has
// gone back to Meta). Each message id is handled once (WhatsAppEvent is
// the idempotency key; Meta retries). Message text is used for the reply
// and never stored or logged; phone numbers are never logged.
import { teamWhatsAppHandoverEmail } from "@/features/deals/emails";
import { getDealDeskContext } from "@/features/deals/public-queries";
import { isFormEnabled } from "@/features/deals/services";
import {
  AWAITING_REFERENCE,
  type Contact,
  dealReply,
  decide,
  menuReply,
  PAUSE_MS,
  personReply,
  ratesReply,
  type Reply,
  SERVICES,
  serviceReply,
  trackAskReply,
  trackInvalidReply,
  unknownReply,
} from "@/features/whatsapp/bot";
import { alertTeam } from "@/features/notifications/alert";
import { whatsappHandoverPayload } from "@/features/notifications/events";
import { markAsRead, sendReply } from "@/features/whatsapp/client";
import { type Inbound, parseWebhook } from "@/features/whatsapp/payload";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/server/db";
import { formatBoardPrice, formatRate } from "@/lib/format";
import { siteUrl } from "@/lib/site-url";

const log = (what: string, error?: unknown) =>
  console.error(
    `[whatsapp] ${what}${error ? `: ${error instanceof Error ? error.name : "error"}` : ""}`,
  );

// Records a message id; false when it's already been handled.
async function claim(
  waMessageId: string,
  waId: string,
  direction: "IN" | "OUT",
  type: string,
): Promise<boolean> {
  try {
    await db.whatsAppEvent.create({
      data: { waMessageId, waId, direction, type },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return false;
    throw error;
  }
}

async function send(to: string, reply: Reply) {
  const id = await sendReply(to, reply);
  if (id) await claim(id, to, "OUT", reply.kind).catch(() => {});
}

// One alert per chat per hour at most, however often "Talk to a person"
// is tapped: the hour's alert is itself an event id.
async function handover(waId: string, now: Date) {
  const hour = Math.floor(now.getTime() / 3_600_000);
  if (!(await claim(`alert:${waId}:${hour}`, waId, "OUT", "alert"))) return;
  const ctx = await getDealDeskContext();
  if (!ctx) return;
  // Email and push together; the push says only that someone is waiting.
  await alertTeam({
    organizationId: ctx.org.id,
    event: "whatsappHandover",
    dealId: null,
    email: teamWhatsAppHandoverEmail(),
    push: whatsappHandoverPayload(),
    label: "Team alerted: WhatsApp handover",
  });
}

async function handleMessage(m: Inbound, now: Date) {
  if (!(await claim(m.id, m.from, "IN", m.type))) return; // seen before
  void markAsRead(m.id);

  const existing = await db.whatsAppContact.findUnique({
    where: { waId: m.from },
  });
  const contact: Contact = {
    isNew: !existing,
    state: existing?.state ?? null,
    stateAt: existing?.stateAt ?? null,
    pausedUntil: existing?.botPausedUntil ?? null,
  };
  const intent = decide({ text: m.text, choice: m.choice }, contact, now);

  // What changes on the contact, written before replying.
  const update: Prisma.WhatsAppContactUpdateInput = { lastInboundAt: now };
  if (intent.intent === "menu") {
    update.state = null;
    update.stateAt = null;
    if (intent.resume) update.botPausedUntil = null;
  }
  if (intent.intent === "track-ask") {
    update.state = AWAITING_REFERENCE;
    update.stateAt = now;
  }
  if (intent.intent === "track-lookup" || intent.intent === "person") {
    update.state = null;
    update.stateAt = null;
  }
  if (intent.intent === "person")
    update.botPausedUntil = new Date(now.getTime() + PAUSE_MS);
  await db.whatsAppContact.upsert({
    where: { waId: m.from },
    create: {
      waId: m.from,
      firstSeenAt: now,
      lastInboundAt: now,
      state: (update.state as string | null | undefined) ?? null,
      stateAt: (update.stateAt as Date | null | undefined) ?? null,
      botPausedUntil:
        (update.botPausedUntil as Date | null | undefined) ?? null,
    },
    update,
  });

  if (intent.intent === "silent") return;
  const ctx = await getDealDeskContext();
  const brand = ctx?.org.name ?? "Stereolinkz";

  switch (intent.intent) {
    case "menu":
      return send(m.from, menuReply(brand, m.name));
    case "service": {
      const form = SERVICES[intent.service].form;
      const available = !!ctx && isFormEnabled(form, ctx.org.servicesEnabled);
      return send(
        m.from,
        serviceReply(intent.service, siteUrl().origin, available),
      );
    }
    case "rates":
      return send(
        m.from,
        ratesReply(
          {
            forex: ctx?.forex
              ? {
                  timeLabel:
                    `${ctx.forex.dateLabel}, ${ctx.forex.timeLabel}`.replace(
                      /^, /,
                      "",
                    ),
                  rows: ctx.forex.rows,
                }
              : null,
            pof: ctx?.pof
              ? {
                  rows: ctx.pof.rows.map((r) => ({
                    name: r.shortName ?? r.name,
                    rate: r.rate,
                  })),
                }
              : null,
          },
          { naira: (v) => `₦${formatRate(v)}`, pct: formatBoardPrice },
        ),
      );
    case "track-ask":
      return send(m.from, trackAskReply);
    case "track-invalid":
      return send(m.from, trackInvalidReply);
    case "track-lookup": {
      const deal = ctx
        ? await db.deal.findUnique({
            where: {
              organizationId_ref: {
                organizationId: ctx.org.id,
                ref: intent.ref,
              },
            },
            select: { customerWhatsapp: true, status: true },
          })
        : null;
      return send(m.from, dealReply(m.from, intent.ref, deal));
    }
    case "person":
      await send(m.from, personReply);
      return handover(m.from, now);
    case "unknown":
      return send(m.from, unknownReply);
  }
}

// A message sent from the WhatsApp Business app (coexistence): a person is
// handling the chat, so the bot pauses for 12 hours.
async function handleEcho(id: string, to: string, now: Date) {
  if (!(await claim(id, to, "OUT", "echo"))) return;
  const until = new Date(now.getTime() + PAUSE_MS);
  await db.whatsAppContact.upsert({
    where: { waId: to },
    create: { waId: to, firstSeenAt: now, botPausedUntil: until },
    update: { botPausedUntil: until, state: null, stateAt: null },
  });
}

export async function processWebhook(body: unknown) {
  const { messages, echoes } = parseWebhook(body);
  const now = new Date();
  for (const e of echoes)
    await handleEcho(e.id, e.to, now).catch((err) => log("echo failed", err));
  for (const m of messages)
    await handleMessage(m, now).catch((err) => log("message failed", err));
}
