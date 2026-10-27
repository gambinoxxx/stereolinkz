"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { TEST_PAYLOAD } from "@/features/notifications/events";
import { pushReady, sendToDevices } from "@/features/notifications/push";
import { saveDevice } from "@/features/notifications/save";
import {
  endpointInput,
  preferenceInput,
  subscriptionInput,
} from "@/features/notifications/schema";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";

// Settings → Notifications. Every team member manages their own devices
// and switches (no owner check); each action touches only the signed-in
// member's own records.

const PAGE = "/admin/settings/notifications";
const NOT_READY =
  "Notifications aren’t set up on the server yet. Ask the owner to add the VAPID keys.";

export const saveSubscription = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ id: string }>> => {
    const parsed = subscriptionInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: "This browser sent an unexpected subscription.",
      };
    if (!pushReady()) return { ok: false, error: NOT_READY };
    const ua = (await headers()).get("user-agent") ?? "";
    const { id } = await saveDevice(member, parsed.data, ua);
    revalidatePath(PAGE);
    return { ok: true, data: { id } };
  },
);

// "Remove" in Your devices.
export const removeDevice = safeAction(
  async (member, id: unknown): Promise<ActionResult<{ removed: number }>> => {
    if (typeof id !== "string") return { ok: false, error: "Unknown device." };
    const { count } = await db.pushSubscription.deleteMany({
      where: { id, membershipId: member.membershipId },
    });
    revalidatePath(PAGE);
    return { ok: true, data: { removed: count } };
  },
);

// "Turn off on this device" (the browser has already unsubscribed).
export const removeThisDevice = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ removed: number }>> => {
    const parsed = endpointInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Unknown device." };
    const { count } = await db.pushSubscription.deleteMany({
      where: { endpoint: parsed.data, membershipId: member.membershipId },
    });
    revalidatePath(PAGE);
    return { ok: true, data: { removed: count } };
  },
);

export const sendTestNotification = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ sent: number }>> => {
    const parsed = endpointInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Unknown device." };
    if (!pushReady()) return { ok: false, error: NOT_READY };
    const devices = await db.pushSubscription.findMany({
      where: { endpoint: parsed.data, membershipId: member.membershipId },
      select: {
        id: true,
        endpoint: true,
        p256dh: true,
        auth: true,
        failureCount: true,
      },
    });
    if (devices.length === 0)
      return {
        ok: false,
        error: "This device isn’t turned on. Turn it on first.",
      };
    const sent = await sendToDevices(devices, TEST_PAYLOAD, "high");
    revalidatePath(PAGE);
    return sent
      ? { ok: true, data: { sent } }
      : {
          ok: false,
          error: "The test didn’t reach this device. Turn it off and on again.",
        };
  },
);

export const setPreference = safeAction(
  async (member, raw: unknown): Promise<ActionResult<{ on: boolean }>> => {
    const parsed = preferenceInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Unknown alert." };
    const { event, on } = parsed.data;
    await db.notificationPreference.upsert({
      where: { membershipId: member.membershipId },
      create: { membershipId: member.membershipId, [event]: on },
      update: { [event]: on },
    });
    revalidatePath(PAGE);
    return { ok: true, data: { on } };
  },
);
