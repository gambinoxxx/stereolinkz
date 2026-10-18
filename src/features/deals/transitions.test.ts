import { describe, expect, it, vi } from "vitest";

import {
  canTransition,
  DealTransitionError,
  TRANSITIONS,
  transitionDeal,
  type TransitionTx,
} from "@/features/deals/transitions";
import { DealStatus } from "@/generated/prisma/enums";

const member = { type: "MEMBER" as const, membershipId: "m-1" };

const ALL = Object.values(DealStatus);
type Mover = "MEMBER" | "SYSTEM";
const ALLOWED: [DealStatus, DealStatus, Mover][] = [
  ["NEW", "AGREED", "MEMBER"],
  ["NEW", "CANCELLED", "MEMBER"],
  ["AGREED", "AWAITING_PAYMENT", "MEMBER"],
  ["AGREED", "CANCELLED", "MEMBER"],
  ["AWAITING_PAYMENT", "PAYMENT_RECEIVED", "MEMBER"],
  ["AWAITING_PAYMENT", "CANCELLED", "MEMBER"],
  ["PAYMENT_RECEIVED", "PROCESSING", "MEMBER"],
  ["PAYMENT_RECEIVED", "COMPLETED", "MEMBER"],
  ["PROCESSING", "COMPLETED", "MEMBER"],
  // Crypto (Phase 13)
  ["AWAITING_DEPOSIT", "DEPOSIT_SEEN", "SYSTEM"],
  ["AWAITING_DEPOSIT", "EXPIRED", "SYSTEM"],
  ["AWAITING_DEPOSIT", "FLAGGED", "SYSTEM"],
  ["AWAITING_DEPOSIT", "CANCELLED", "MEMBER"],
  ["DEPOSIT_SEEN", "DEPOSIT_COMPLETE", "SYSTEM"],
  ["DEPOSIT_SEEN", "FLAGGED", "SYSTEM"],
  ["DEPOSIT_SEEN", "RATE_TO_AGREE", "SYSTEM"],
  ["RATE_TO_AGREE", "DEPOSIT_COMPLETE", "MEMBER"],
  ["RATE_TO_AGREE", "CANCELLED", "MEMBER"],
  ["DEPOSIT_COMPLETE", "PAID_OUT", "MEMBER"],
  ["EXPIRED", "AWAITING_DEPOSIT", "MEMBER"],
  ["EXPIRED", "FLAGGED", "MEMBER"],
  ["EXPIRED", "CANCELLED", "MEMBER"],
  ["FLAGGED", "DEPOSIT_COMPLETE", "MEMBER"],
  ["FLAGGED", "CANCELLED", "MEMBER"],
  ["FLAGGED", "AWAITING_DEPOSIT", "MEMBER"],
];
const key = ([a, b]: [DealStatus, DealStatus, ...unknown[]]) => `${a}→${b}`;
const allowed = new Set(ALLOWED.map(key));
const actorFor = (mover: Mover) =>
  mover === "MEMBER" ? member : ({ type: "SYSTEM" } as const);

function fakeTx(count = 1) {
  const updateMany = vi.fn().mockResolvedValue({ count });
  const create = vi.fn().mockResolvedValue({});
  return {
    tx: {
      deal: { updateMany },
      dealEvent: { create },
    } as unknown as TransitionTx,
    updateMany,
    create,
  };
}

describe("TRANSITIONS", () => {
  it("is exactly the Phase 12, 13 and 13b table, with its movers", () => {
    const listed = Object.entries(TRANSITIONS).flatMap(([from, tos]) =>
      Object.entries(tos!).map(([to, mover]) => `${from}→${to}:${mover}`),
    );
    expect(new Set(listed)).toEqual(
      new Set(ALLOWED.map(([a, b, m]) => `${a}→${b}:${m}`)),
    );
  });

  it("checks every pair of statuses", () => {
    for (const from of ALL)
      for (const to of ALL)
        expect(canTransition(from, to), `${from}→${to}`).toBe(
          allowed.has(`${from}→${to}`),
        );
  });
});

describe("transitionDeal", () => {
  it.each(ALLOWED)(
    "moves %s → %s (%s) and logs it in the same transaction",
    async (from, to, mover) => {
      const { tx, updateMany, create } = fakeTx();
      const now = new Date("2026-10-13T10:00:00Z");
      await transitionDeal(
        tx,
        { id: "d1", status: from },
        to,
        actorFor(mover),
        {
          message: "Moved",
          now,
          set: { cancelReason: null },
        },
      );
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: "d1", status: from },
        data: { cancelReason: null, status: to, statusChangedAt: now },
      });
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dealId: "d1",
          type: "STATUS_CHANGED",
          fromStatus: from,
          toStatus: to,
          message: "Moved",
          actorType: mover,
          actorMembershipId: mover === "MEMBER" ? "m-1" : null,
          createdAt: now,
        }),
      });
    },
  );

  it("refuses every forbidden pair and writes nothing", async () => {
    let refused = 0;
    for (const from of ALL)
      for (const to of ALL) {
        if (allowed.has(`${from}→${to}`)) continue;
        const { tx, updateMany, create } = fakeTx();
        await expect(
          transitionDeal(tx, { id: "d1", status: from }, to, member, {
            message: "x",
          }),
        ).rejects.toMatchObject({
          code: "NOT_ALLOWED",
        });
        expect(updateMany).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
        refused++;
      }
    expect(refused).toBe(ALL.length * ALL.length - ALLOWED.length);
  });

  it("refuses COMPLETED → NEW (a crafted request)", async () => {
    const { tx } = fakeTx();
    await expect(
      transitionDeal(tx, { id: "d1", status: "COMPLETED" }, "NEW", member, {
        message: "x",
      }),
    ).rejects.toBeInstanceOf(DealTransitionError);
  });

  it.each(ALLOWED)(
    "lets only its mover make %s → %s (%s)",
    async (from, to, mover) => {
      const others = [
        { type: "CUSTOMER" as const },
        mover === "MEMBER" ? { type: "SYSTEM" as const } : member,
      ];
      for (const actor of others) {
        const { tx, updateMany, create } = fakeTx();
        await expect(
          transitionDeal(tx, { id: "d1", status: from }, to, actor, {
            message: "x",
          }),
        ).rejects.toMatchObject({ code: "ACTOR" });
        expect(updateMany).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
      }
    },
  );

  it("never lets a customer or the system move a status", async () => {
    for (const type of ["CUSTOMER", "SYSTEM"] as const) {
      const { tx, updateMany } = fakeTx();
      await expect(
        transitionDeal(
          tx,
          { id: "d1", status: "AWAITING_PAYMENT" },
          "PAYMENT_RECEIVED",
          { type },
          { message: "x" },
        ),
      ).rejects.toMatchObject({
        code: "ACTOR",
      });
      expect(updateMany).not.toHaveBeenCalled();
    }
  });

  it("writes no event when the deal changed in between", async () => {
    const { tx, create } = fakeTx(0);
    await expect(
      transitionDeal(tx, { id: "d1", status: "NEW" }, "AGREED", member, {
        message: "x",
      }),
    ).rejects.toMatchObject({
      code: "CHANGED",
    });
    expect(create).not.toHaveBeenCalled();
  });
});
