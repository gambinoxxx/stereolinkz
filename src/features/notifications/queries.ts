import "server-only";

import { createHash } from "node:crypto";

import {
  DEFAULT_PREFERENCES,
  TEAM_EVENTS,
  type TeamEvent,
} from "@/features/notifications/events";
import { db } from "@/lib/server/db";

export type MyDevice = {
  id: string;
  label: string;
  createdAt: string;
  lastSuccessAt: string | null;
  // So the page can tell which one is "this device" without the endpoint
  // itself ever reaching the HTML.
  endpointHash: string;
};

export const endpointHash = (endpoint: string) =>
  createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

// Settings → Notifications: the member's own devices and switches.
export async function getMyNotifications(membershipId: string): Promise<{
  devices: MyDevice[];
  preferences: Record<TeamEvent, boolean>;
}> {
  const [devices, pref] = await Promise.all([
    db.pushSubscription.findMany({
      where: { membershipId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        endpoint: true,
        deviceLabel: true,
        createdAt: true,
        lastSuccessAt: true,
      },
    }),
    db.notificationPreference.findUnique({ where: { membershipId } }),
  ]);
  const preferences = { ...DEFAULT_PREFERENCES };
  if (pref) for (const e of TEAM_EVENTS) preferences[e] = pref[e];
  return {
    devices: devices.map((d) => ({
      id: d.id,
      label: d.deviceLabel,
      createdAt: d.createdAt.toISOString(),
      lastSuccessAt: d.lastSuccessAt?.toISOString() ?? null,
      endpointHash: endpointHash(d.endpoint),
    })),
    preferences,
  };
}
