import "server-only";

import type { PushPayload, TeamEvent } from "@/features/notifications/events";
import { notifyTeam } from "@/features/notifications/push";
import { db } from "@/lib/server/db";
import {
  alertRecipients,
  type Email,
  emailReady,
  sendEach,
} from "@/lib/server/email";

// The one way a team alert goes out: email (to the team inboxes, when the
// organization's email switch for it is on) and web push (to each member
// who wants this alert, on all their devices), side by side. Callers run it
// inside after(), so it never slows or fails a deal; it never throws.
// Logged once on the deal as ALERT_SENT, with what went where.
export type TeamAlert = {
  organizationId: string;
  event: TeamEvent;
  dealId: string | null; // null: not about one deal (WhatsApp handover)
  // null when the organization's email alerts for this are off.
  email: Omit<Email, "to"> | null;
  push: PushPayload;
  label: string; // "Team alerted", "Payout overdue: team alerted", …
  // Log even when nothing was sent (a payout passing its target is
  // recorded on the deal either way).
  quietLabel?: string;
};

export async function alertTeam(alert: TeamAlert): Promise<{
  emails: number;
  devices: number;
}> {
  const team = alertRecipients();
  const [email, push] = await Promise.allSettled([
    alert.email && emailReady() && team.length
      ? sendEach(team, alert.email)
      : Promise.resolve(0),
    notifyTeam(alert.organizationId, alert.event, alert.push),
  ]);
  const emails = email.status === "fulfilled" ? email.value : 0;
  const devices = push.status === "fulfilled" ? push.value : 0;
  if (email.status === "rejected") console.error("[alertTeam] email failed");

  if (alert.dealId && (emails || devices || alert.quietLabel)) {
    const parts = [
      emails ? `email to ${emails} of ${team.length}` : null,
      devices ? `push to ${devices} device${devices === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    await db.dealEvent
      .create({
        data: {
          dealId: alert.dealId,
          type: "ALERT_SENT",
          message: parts.length
            ? `${alert.label} (${parts.join(", ")})`
            : alert.quietLabel!,
          data: { recipients: emails, devices },
          actorType: "SYSTEM",
        },
      })
      .catch(() => console.error("[alertTeam] log failed"));
  }
  return { emails, devices };
}
