import { headers } from "next/headers";

import { saveDevice } from "@/features/notifications/save";
import { resubscribeInput } from "@/features/notifications/schema";
import { requireMember } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

// The service worker's pushsubscriptionchange: the browser replaced a
// device's subscription. Swaps the old record (only the signed-in
// member's own) for the new one. Called with the session's cookies.
export async function POST(request: Request) {
  const member = await requireMember();
  const parsed = resubscribeInput.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  const { oldEndpoint, subscription } = parsed.data;
  if (oldEndpoint && oldEndpoint !== subscription.endpoint)
    await db.pushSubscription.deleteMany({
      where: { endpoint: oldEndpoint, membershipId: member.membershipId },
    });
  await saveDevice(
    member,
    subscription,
    (await headers()).get("user-agent") ?? "",
  );
  return Response.json({ ok: true });
}
