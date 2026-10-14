// The queue's "Waiting" column: time since the last status change, with a
// colour when a deal is waiting too long. NEW deals turn amber at two
// thirds of the contact SLA and red past it; a received payment not moved
// on turns amber after 30 minutes (it then "needs action").
import type { DealStatus } from "@/generated/prisma/enums";

export type WaitTone = "normal" | "soon" | "late";

export function waitingText(minutes: number): string {
  if (minutes < 60) return `${Math.max(0, Math.floor(minutes))} min`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 60 / 24)} d`;
}

export function waiting(
  status: DealStatus,
  statusChangedAt: Date,
  now: Date,
  contactSlaMinutes: number,
): { text: string; tone: WaitTone } {
  if (status === "COMPLETED" || status === "CANCELLED")
    return { text: "—", tone: "normal" };
  const minutes = (now.getTime() - statusChangedAt.getTime()) / 60_000;
  let tone: WaitTone = "normal";
  if (status === "NEW")
    tone =
      minutes >= contactSlaMinutes
        ? "late"
        : minutes >= (contactSlaMinutes * 2) / 3
          ? "soon"
          : "normal";
  if (status === "PAYMENT_RECEIVED" && minutes >= 30) tone = "soon";
  return { text: waitingText(minutes), tone };
}
