// Database checks for the deal desk, against a DEVELOPMENT database only.
// Opt-in: DEAL_DB_TESTS=1 npx vitest run src/features/deals/create.db.test.ts
// Refuses to run against the production endpoint.
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: [".env.local"], quiet: true });

const PROD_HOST = "ep-twilight-brook";
const enabled =
  process.env.DEAL_DB_TESTS === "1" &&
  !!process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes(PROD_HOST);

describe.skipIf(!enabled)("deal desk on the database", async () => {
  const { db } = await import("@/lib/server/db");
  const { createDeal } = await import("@/features/deals/create");
  const created: string[] = [];
  let organizationId = "";

  beforeAll(async () => {
    const org = await db.organization.findFirstOrThrow({
      select: { id: true },
    });
    organizationId = org.id;
  });

  afterAll(async () => {
    // Test rows only (events and files cascade).
    await db.deal.deleteMany({ where: { id: { in: created } } });
    await db.$disconnect();
  });

  const newDeal = (i: number) =>
    createDeal({
      organizationId,
      service: "FOREX_BUY",
      customer: { name: `Test ${i}`, whatsapp: "+234 800 000 0000" },
      details: { service: "FOREX_BUY", method: "TRANSFER" },
      currency: "USD",
      amount: "100",
      quote: {
        rate: "1378",
        naira: "137800",
        boardId: "test-board",
        timeLabel: "10:25 AM",
        dateLabel: "Tue",
        side: "sell",
      },
      ownerMembershipId: null,
      trackingTokenHash: "0".repeat(64),
      ipHash: null,
      actor: { type: "SYSTEM" },
      message: "Database test",
    });

  it("gives 20 parallel creates 20 different, consecutive references", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => newDeal(i)),
    );
    created.push(...results.map((r) => r.id));
    const refs = results.map((r) => r.ref);
    expect(new Set(refs).size).toBe(20);
    const numbers = refs
      .map((r) => Number(r.split("-")[1]))
      .sort((a, b) => a - b);
    expect(numbers.at(-1)! - numbers[0]!).toBe(19);
    // Each deal has exactly its REQUESTED event.
    const events = await db.dealEvent.groupBy({
      by: ["dealId"],
      where: { dealId: { in: created } },
      _count: true,
    });
    expect(events).toHaveLength(20);
    expect(events.every((e) => e._count === 1)).toBe(true);
  }, 60_000);

  it("never lets the quoted rate change", async () => {
    const id = created[0]!;
    await expect(
      db.deal.update({ where: { id }, data: { quotedRate: "1" } }),
    ).rejects.toThrow(/deal_quote_immutable/);
    await expect(
      db.deal.update({ where: { id }, data: { quotedNaira: "1" } }),
    ).rejects.toThrow(/deal_quote_immutable/);
    // Other fields still update.
    await expect(
      db.deal.update({ where: { id }, data: { cancelReason: "test" } }),
    ).resolves.toBeTruthy();
  });

  it("never lets an event be edited", async () => {
    const event = await db.dealEvent.findFirstOrThrow({
      where: { dealId: created[0]! },
    });
    await expect(
      db.dealEvent.update({
        where: { id: event.id },
        data: { message: "edited" },
      }),
    ).rejects.toThrow(/deal_event_append_only/);
  });

  it("rejects a zero or negative amount", async () => {
    await expect(
      db.deal.update({ where: { id: created[1]! }, data: { amount: "0" } }),
    ).rejects.toThrow(/deal_amount_positive/);
  });
});
