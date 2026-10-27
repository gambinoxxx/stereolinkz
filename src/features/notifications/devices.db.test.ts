// Devices on a DEVELOPMENT database. Opt-in:
// DEAL_DB_TESTS=1 npx vitest run src/features/notifications/devices.db.test.ts
// Uses its own throwaway endpoints; all deleted afterwards.
import { randomBytes } from "node:crypto";

import { config } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";

config({ path: [".env.local"], quiet: true });

const PROD_HOST = "ep-twilight-brook";
const enabled =
  process.env.DEAL_DB_TESTS === "1" &&
  !!process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes(PROD_HOST);

describe.skipIf(!enabled)("push devices on the database", async () => {
  const { db } = await import("@/lib/server/db");
  const { saveDevice } = await import("@/features/notifications/save");
  const tag = randomBytes(4).toString("hex");
  const endpoint = `https://push.example.test/${tag}`;
  const keys = { p256dh: "p256dh-key", auth: "auth-key" };

  afterAll(async () => {
    await db.pushSubscription.deleteMany({
      where: { endpoint: { startsWith: "https://push.example.test/" } },
    });
    await db.$disconnect();
  });

  it("keeps one record per endpoint, updated when turned on again", async () => {
    const m = await db.membership.findFirstOrThrow({
      select: { id: true, organizationId: true },
    });
    const member = { organizationId: m.organizationId, membershipId: m.id };
    const a = await saveDevice(
      member,
      { endpoint, keys },
      "Mozilla/5.0 (iPhone)",
    );
    await db.pushSubscription.update({
      where: { id: a.id },
      data: { failureCount: 3 },
    });
    const b = await saveDevice(
      member,
      { endpoint, keys: { ...keys, auth: "new-auth" } },
      "Mozilla/5.0 (iPhone)",
    );
    expect(b.id).toBe(a.id);
    const row = await db.pushSubscription.findUniqueOrThrow({
      where: { endpoint },
    });
    expect(row).toMatchObject({ auth: "new-auth", failureCount: 0 });
    // Another member's removal can't touch it.
    const { count } = await db.pushSubscription.deleteMany({
      where: { id: a.id, membershipId: "someone-else" },
    });
    expect(count).toBe(0);
  });
});
