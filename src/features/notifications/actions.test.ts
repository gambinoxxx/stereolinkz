import { beforeEach, describe, expect, it, vi } from "vitest";

// The signed-in member every action runs as.
const member = {
  userId: "u1",
  membershipId: "m1",
  organizationId: "org1",
  role: "ADMIN" as const, // not the owner: everyone manages their own
};
vi.mock("@/lib/server/auth", () => ({ requireMember: async () => member }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "user-agent":
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    }),
}));
const sendToDevices = vi.fn();
vi.mock("@/features/notifications/push", () => ({
  pushReady: () => true,
  sendToDevices: (...a: unknown[]) => sendToDevices(...a),
}));
const db = {
  pushSubscription: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  notificationPreference: { upsert: vi.fn() },
};
vi.mock("@/lib/server/db", () => ({ db }));

const {
  removeDevice,
  removeThisDevice,
  saveSubscription,
  sendTestNotification,
  setPreference,
} = await import("@/features/notifications/actions");

const sub = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "BPkey-_", auth: "authkey" },
};

beforeEach(() => {
  for (const t of [db.pushSubscription, db.notificationPreference])
    for (const f of Object.values(t)) f.mockReset();
  db.pushSubscription.upsert.mockResolvedValue({ id: "s1" });
  db.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
  sendToDevices.mockReset().mockResolvedValue(1);
});

describe("a member's own devices", () => {
  it("saves this device for the signed-in member; the same endpoint updates it", async () => {
    expect(await saveSubscription(sub)).toEqual({
      ok: true,
      data: { id: "s1" },
    });
    const call = db.pushSubscription.upsert.mock.calls[0]![0];
    expect(call.where).toEqual({ endpoint: sub.endpoint });
    for (const data of [call.create, call.update])
      expect(data).toMatchObject({
        organizationId: "org1",
        membershipId: "m1",
        p256dh: "BPkey-_",
        auth: "authkey",
        deviceLabel: "Android · Chrome",
        failureCount: 0,
      });
  });

  it("refuses a subscription that isn't one", async () => {
    for (const bad of [
      null,
      { endpoint: "http://insecure.example/x", keys: sub.keys },
      { endpoint: sub.endpoint, keys: { p256dh: "<script>", auth: "a" } },
    ])
      expect(await saveSubscription(bad)).toMatchObject({ ok: false });
    expect(db.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it("removes and tests only the member's own devices", async () => {
    await removeDevice("s9");
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: "s9", membershipId: "m1" },
    });
    await removeThisDevice(sub.endpoint);
    expect(db.pushSubscription.deleteMany).toHaveBeenLastCalledWith({
      where: { endpoint: sub.endpoint, membershipId: "m1" },
    });
    // Someone else's device: not found for this member, nothing sent.
    db.pushSubscription.findMany.mockResolvedValue([]);
    expect(await sendTestNotification(sub.endpoint)).toMatchObject({
      ok: false,
    });
    expect(db.pushSubscription.findMany.mock.calls[0]![0].where).toEqual({
      endpoint: sub.endpoint,
      membershipId: "m1",
    });
    expect(sendToDevices).not.toHaveBeenCalled();
  });

  it("sets the member's own switch", async () => {
    await setPreference({ event: "payoutOverdue", on: false });
    expect(db.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { membershipId: "m1" },
      create: { membershipId: "m1", payoutOverdue: false },
      update: { payoutOverdue: false },
    });
    expect(await setPreference({ event: "nope", on: true })).toMatchObject({
      ok: false,
    });
  });
});
