import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEach = vi.fn();
vi.mock("@/lib/server/email", () => ({
  alertRecipients: () => ["team@example.com", "owner@example.com"],
  emailReady: () => true,
  sendEach: (...a: unknown[]) => sendEach(...a),
}));
const notifyTeam = vi.fn();
vi.mock("@/features/notifications/push", () => ({
  notifyTeam: (...a: unknown[]) => notifyTeam(...a),
}));
const create = vi.fn();
vi.mock("@/lib/server/db", () => ({ db: { dealEvent: { create } } }));

const { alertTeam } = await import("@/features/notifications/alert");
const { TEAM_EVENTS } = await import("@/features/notifications/events");

const email = { subject: "s", text: "t", html: "h" };
const push = { title: "T", body: "B", url: "/admin", tag: "x" };

beforeEach(() => {
  sendEach.mockReset().mockResolvedValue(2);
  notifyTeam.mockReset().mockResolvedValue(3);
  create.mockReset().mockResolvedValue({});
});

describe("alertTeam, the one way a team alert goes out", () => {
  it("sends email and push for every event, and logs both on the deal", async () => {
    for (const event of TEAM_EVENTS) {
      sendEach.mockClear();
      notifyTeam.mockClear();
      create.mockClear();
      expect(
        await alertTeam({
          organizationId: "org1",
          event,
          dealId: "d1",
          email,
          push,
          label: "Team alerted",
        }),
      ).toEqual({ emails: 2, devices: 3 });
      expect(sendEach).toHaveBeenCalledWith(
        ["team@example.com", "owner@example.com"],
        email,
      );
      expect(notifyTeam).toHaveBeenCalledWith("org1", event, push);
      expect(create.mock.calls[0]![0].data).toMatchObject({
        dealId: "d1",
        type: "ALERT_SENT",
        message: "Team alerted (email to 2 of 2, push to 3 devices)",
        data: { recipients: 2, devices: 3 },
      });
    }
  });

  it("still pushes when the organization's emails for it are off", async () => {
    await alertTeam({
      organizationId: "org1",
      event: "newDeal",
      dealId: "d1",
      email: null,
      push,
      label: "Team alerted",
    });
    expect(sendEach).not.toHaveBeenCalled();
    expect(notifyTeam).toHaveBeenCalled();
  });

  it("never throws when a channel fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sendEach.mockRejectedValue(new Error("resend down"));
    notifyTeam.mockRejectedValue(new Error("push down"));
    create.mockRejectedValue(new Error("db down"));
    await expect(
      alertTeam({
        organizationId: "org1",
        event: "payoutOverdue",
        dealId: "d1",
        email,
        push,
        label: "Payout overdue: team alerted",
        quietLabel: "Payout overdue: past the payout target",
      }),
    ).resolves.toEqual({ emails: 0, devices: 0 });
  });

  it("logs a quiet line when nothing went out, only if asked", async () => {
    sendEach.mockResolvedValue(0);
    notifyTeam.mockResolvedValue(0);
    await alertTeam({
      organizationId: "org1",
      event: "newDeal",
      dealId: "d1",
      email,
      push,
      label: "Team alerted",
    });
    expect(create).not.toHaveBeenCalled();
    await alertTeam({
      organizationId: "org1",
      event: "payoutOverdue",
      dealId: "d1",
      email,
      push,
      label: "Payout overdue: team alerted",
      quietLabel: "Payout overdue: past the payout target",
    });
    expect(create.mock.calls[0]![0].data.message).toBe(
      "Payout overdue: past the payout target",
    );
  });
});
