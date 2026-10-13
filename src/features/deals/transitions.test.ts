import { describe, expect, it, vi } from "vitest";

import {
  canTransition,
  DealTransitionError,
  TRANSITIONS,
  transitionDeal,
  type TransitionTx,
} from "@/features/deals/transitions";
import { DealStatus } from "@/generated/prisma/enums";

const ALL = Object.values(DealStatus);
const ALLOWED: [DealStatus, DealStatus][] = [
  ["NEW", "AGREED"],
  ["NEW", "CANCELLED"],
  ["AGREED", "AWAITING_PAYMENT"],
  ["AGREED", "CANCELLED"],
  ["AWAITING_PAYMENT", "PAYMENT_RECEIVED"],
  ["AWAITING_PAYMENT", "CANCELLED"],
  ["PAYMENT_RECEIVED", "PROCESSING"],
  ["PAYMENT_RECEIVED", "COMPLETED"],
  ["PROCESSING", "COMPLETED"],
];
const key = ([a, b]: [DealStatus, DealStatus]) => `${a}→${b}`;
const allowed = new Set(ALLOWED.map(key));

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
const member = { type: "MEMBER" as const, membershipId: "m-1" };

describe("TRANSITIONS", () => {
  it("is exactly the Phase 12 table", () => {
    const listed = Object.entries(TRANSITIONS).flatMap(([from, tos]) =>
      tos!.map((to) => `${from}→${to}`),
    );
    expect(new Set(listed)).toEqual(allowed);
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
    "moves %s → %s and logs it in the same transaction",
    async (from, to) => {
      const { tx, updateMany, create } = fakeTx();
      const now = new Date("2026-10-13T10:00:00Z");
      await transitionDeal(tx, { id: "d1", status: from }, to, member, {
        message: "Moved",
        now,
        set: { cancelReason: null },
      });
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
          actorType: "MEMBER",
          actorMembershipId: "m-1",
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
