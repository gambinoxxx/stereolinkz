import "server-only";

import { deviceLabel } from "@/features/notifications/device";
import type { SubscriptionInput } from "@/features/notifications/schema";
import { db } from "@/lib/server/db";

// Saves a device for the signed-in member. The endpoint is unique: the
// same browser turned on again updates its record (and belongs to whoever
// turned it on last).
export function saveDevice(
  member: { organizationId: string; membershipId: string },
  sub: SubscriptionInput,
  userAgent: string,
) {
  const ua = userAgent.slice(0, 400);
  const data = {
    organizationId: member.organizationId,
    membershipId: member.membershipId,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    deviceLabel: deviceLabel(ua),
    userAgent: ua,
    failureCount: 0,
  };
  return db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { endpoint: sub.endpoint, ...data },
    update: data,
    select: { id: true },
  });
}
