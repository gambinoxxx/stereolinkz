import { z } from "zod";

import { TEAM_EVENTS } from "@/features/notifications/events";

// A browser's PushSubscription.toJSON(). The endpoint is the push
// service's https URL; the keys are base64url.
const base64url = z
  .string()
  .regex(/^[A-Za-z0-9_-]+=*$/)
  .max(200);
export const subscriptionInput = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({ p256dh: base64url, auth: base64url }),
});
export type SubscriptionInput = z.infer<typeof subscriptionInput>;

export const endpointInput = z.url({ protocol: /^https$/ }).max(1000);

export const preferenceInput = z.object({
  event: z.enum(TEAM_EVENTS),
  on: z.boolean(),
});

export const resubscribeInput = z.object({
  oldEndpoint: endpointInput.nullable(),
  subscription: subscriptionInput,
});
