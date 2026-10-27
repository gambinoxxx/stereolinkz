import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...a: unknown[]) => sendNotification(...a),
  },
}));

const db = {
  membership: { findMany: vi.fn() },
  pushSubscription: { updateMany: vi.fn(), deleteMany: vi.fn() },
};
vi.mock("@/lib/server/db", () => ({ db }));

process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public";
process.env.VAPID_PRIVATE_KEY = "test-private";
process.env.VAPID_SUBJECT = "mailto:support@stereolinkz.com";

const { notifyTeam, MAX_FAILURES } =
  await import("@/features/notifications/push");
const { newDealPayload } = await import("@/features/notifications/events");

const payload = newDealPayload({
  ref: "SLZ-1094",
  service: "POF",
  amount: "1000000",
  currency: "NGN",
});
const device = (id: string, failureCount = 0) => ({
  id,
  endpoint: `https://push.example/${id}`,
  p256dh: "key",
  auth: "auth",
  failureCount,
});
const gone = (statusCode: number) =>
  Object.assign(new Error("push"), { statusCode });

beforeEach(() => {
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
  for (const f of [
    db.membership.findMany,
    db.pushSubscription.updateMany,
    db.pushSubscription.deleteMany,
  ])
    f.mockReset().mockResolvedValue({ count: 1 });
});

describe("notifyTeam", () => {
  it("sends to every device of each member who wants the alert", async () => {
    db.membership.findMany.mockResolvedValue([
      {
        notificationPreference: null,
        pushSubscriptions: [device("a"), device("b")],
      }, // defaults: on
      {
        notificationPreference: { newDeal: true },
        pushSubscriptions: [device("c")],
      },
      {
        notificationPreference: { newDeal: false },
        pushSubscriptions: [device("d")],
      },
    ]);
    expect(await notifyTeam("org1", "newDeal", payload)).toBe(3);
    const sentTo = sendNotification.mock.calls.map((c) => c[0].endpoint);
    expect(sentTo).toEqual([
      "https://push.example/a",
      "https://push.example/b",
      "https://push.example/c",
    ]);
    // Lock-screen-safe body, urgent, a few hours to live, a short timeout.
    expect(JSON.parse(sendNotification.mock.calls[0]![1])).toEqual(payload);
    expect(sendNotification.mock.calls[0]![2]).toMatchObject({
      urgency: "high",
      TTL: 4 * 60 * 60,
      timeout: 5_000,
    });
    // Each success resets the device's failures.
    expect(db.pushSubscription.updateMany).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { lastSuccessAt: expect.any(Date), failureCount: 0 },
    });
  });

  it("uses each member's own switch, and the defaults when there's none", async () => {
    db.membership.findMany.mockResolvedValue([
      { notificationPreference: null, pushSubscriptions: [device("a")] },
    ]);
    expect(await notifyTeam("org1", "dealCancelled", payload)).toBe(0); // off by default
    expect(sendNotification).not.toHaveBeenCalled();
    expect(db.membership.findMany.mock.calls[0]![0].where).toEqual({
      organizationId: "org1",
      pushSubscriptions: { some: {} },
    });
  });

  it("deletes a device that's gone (410 or 404)", async () => {
    db.membership.findMany.mockResolvedValue([
      {
        notificationPreference: null,
        pushSubscriptions: [device("gone"), device("missing"), device("ok")],
      },
    ]);
    sendNotification
      .mockRejectedValueOnce(gone(410))
      .mockRejectedValueOnce(gone(404))
      .mockResolvedValueOnce({ statusCode: 201 });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await notifyTeam("org1", "newDeal", payload)).toBe(1);
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: "gone" },
    });
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: "missing" },
    });
    // The log says what failed, never where.
    for (const [line] of errors.mock.calls) {
      expect(String(line)).toMatch(/^\[push\] send failed: HTTP 4\d\d$/);
      expect(String(line)).not.toContain("push.example");
    }
    errors.mockRestore();
  });

  it("counts other failures and removes a device after 5 in a row", async () => {
    db.membership.findMany.mockResolvedValue([
      {
        notificationPreference: null,
        pushSubscriptions: [
          device("flaky", 1),
          device("dying", MAX_FAILURES - 1),
        ],
      },
    ]);
    sendNotification.mockRejectedValue(gone(500));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await notifyTeam("org1", "newDeal", payload)).toBe(0);
    expect(db.pushSubscription.updateMany).toHaveBeenCalledWith({
      where: { id: "flaky" },
      data: { failureCount: { increment: 1 } },
    });
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: "dying" },
    });
  });

  it("never throws: a failing database or push service just sends nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.membership.findMany.mockRejectedValue(new Error("db down"));
    await expect(notifyTeam("org1", "newDeal", payload)).resolves.toBe(0);
    db.membership.findMany.mockResolvedValue([
      { notificationPreference: null, pushSubscriptions: [device("a")] },
    ]);
    sendNotification.mockImplementation(() => {
      throw new Error("sync throw");
    });
    db.pushSubscription.updateMany.mockRejectedValue(new Error("db down"));
    await expect(notifyTeam("org1", "newDeal", payload)).resolves.toBe(0);
  });

  it("does nothing without the VAPID keys", async () => {
    const saved = process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    try {
      expect(await notifyTeam("org1", "newDeal", payload)).toBe(0);
      expect(db.membership.findMany).not.toHaveBeenCalled();
    } finally {
      process.env.VAPID_PRIVATE_KEY = saved;
    }
  });
});
