import type { Metadata } from "next";

import { NotificationSettings } from "@/features/notifications/components/NotificationSettings";
import { pushReady } from "@/features/notifications/push";
import { getMyNotifications } from "@/features/notifications/queries";
import { requireMember } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Notifications · RateBoard" };

// Settings → Notifications: every team member, for themselves (their own
// devices and which alerts they want). No owner check: nothing here
// touches anyone else.
export default async function NotificationSettingsPage() {
  const { membershipId } = await requireMember();
  const { devices, preferences } = await getMyNotifications(membershipId);
  return (
    <NotificationSettings
      devices={devices}
      preferences={preferences}
      serverReady={pushReady()}
      vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null}
    />
  );
}
