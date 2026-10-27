import "server-only";

import webpush from "web-push";

import {
  DEFAULT_PREFERENCES,
  type PushPayload,
  type TeamEvent,
} from "@/features/notifications/events";
import { db } from "@/lib/server/db";

// Web push (VAPID, the official protocol; no third-party push service).
// Never throws and never slows a deal: callers run it inside after(),
// every device gets its own short timeout, and all sends settle together.
// A device that's gone (404 / 410) is deleted; one that fails 5 times in a
// row is removed. Logs carry only the failure type, never an endpoint or a
// key.

const TTL_SECONDS = 4 * 60 * 60; // a few hours: stale alerts aren't useful
const TIMEOUT_MS = 5_000;
export const MAX_FAILURES = 5;

// High urgency wakes a phone at once (new deals, payouts).
const URGENT: ReadonlySet<TeamEvent> = new Set([
  "newDeal",
  "cryptoDepositComplete",
  "payoutOverdue",
]);

export function pushReady(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
    !!process.env.VAPID_PRIVATE_KEY?.trim() &&
    !!process.env.VAPID_SUBJECT?.trim()
  );
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!.trim(),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  configured = true;
}

type Device = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failureCount: number;
};

const DEVICE_SELECT = {
  id: true,
  endpoint: true,
  p256dh: true,
  auth: true,
  failureCount: true,
} as const;

function failureType(error: unknown): string {
  const status = (error as { statusCode?: unknown })?.statusCode;
  if (typeof status === "number") return `HTTP ${status}`;
  return error instanceof Error ? error.name : "error";
}

// Sends one payload to these devices; returns how many received it.
export async function sendToDevices(
  devices: Device[],
  payload: PushPayload,
  urgency: "high" | "normal" = "normal",
): Promise<number> {
  if (!pushReady() || devices.length === 0) return 0;
  configure();
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    devices.map((d) =>
      webpush.sendNotification(
        { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
        body,
        { TTL: TTL_SECONDS, urgency, timeout: TIMEOUT_MS },
      ),
    ),
  );
  let sent = 0;
  await Promise.allSettled(
    results.map(async (r, i) => {
      const d = devices[i]!;
      if (r.status === "fulfilled") {
        sent++;
        await db.pushSubscription.updateMany({
          where: { id: d.id },
          data: { lastSuccessAt: new Date(), failureCount: 0 },
        });
        return;
      }
      const status = (r.reason as { statusCode?: number })?.statusCode;
      console.error(`[push] send failed: ${failureType(r.reason)}`);
      if (
        status === 404 ||
        status === 410 ||
        d.failureCount + 1 >= MAX_FAILURES
      )
        await db.pushSubscription.deleteMany({ where: { id: d.id } });
      else
        await db.pushSubscription.updateMany({
          where: { id: d.id },
          data: { failureCount: { increment: 1 } },
        });
    }),
  );
  return sent;
}

// Everyone on the team who wants this alert, on all their devices. A
// member with no saved preferences gets the defaults. Returns how many
// devices received it.
export async function notifyTeam(
  organizationId: string,
  event: TeamEvent,
  payload: PushPayload,
): Promise<number> {
  try {
    if (!pushReady()) return 0;
    const members = await db.membership.findMany({
      where: { organizationId, pushSubscriptions: { some: {} } },
      select: {
        notificationPreference: { select: { [event]: true } },
        pushSubscriptions: { select: DEVICE_SELECT },
      },
    });
    const devices = members
      .filter((m) => {
        const pref = m.notificationPreference as Record<string, boolean> | null;
        return pref ? pref[event] === true : DEFAULT_PREFERENCES[event];
      })
      .flatMap((m) => m.pushSubscriptions);
    return await sendToDevices(
      devices,
      payload,
      URGENT.has(event) ? "high" : "normal",
    );
  } catch (error) {
    console.error(`[push] notifyTeam failed: ${failureType(error)}`);
    return 0;
  }
}
