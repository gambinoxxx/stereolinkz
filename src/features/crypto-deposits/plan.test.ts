import { describe, expect, it } from "vitest";

import {
  planDeal,
  type DealPlan,
  type PlanDeal,
} from "@/features/crypto-deposits/plan";

const ADDRESS = "THPvaUhoh2Qn2y9THCZML3H815hhFhn5YC";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const FAKE = "TY2G6iSCd7tyUfYYdjFZ1oVbsohavB1vSh";
const T0 = new Date("2026-10-17T10:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);

const base: PlanDeal = {
  id: "d1",
  status: "AWAITING_DEPOSIT",
  network: "TRC20",
  ticker: "USDT",
  depositAddress: ADDRESS,
  expectedQty: "500.37",
  lockExpiresAt: at(30),
  depositSeenAt: null,
  confirmations: null,
  payoutTargetMinutes: 10,
};
const transfer = {
  network: "TRC20" as const,
  txHash: "c7bd",
  toAddress: ADDRESS,
  tokenContract: USDT,
  amount: "500.37",
  blockTime: at(5),
  confirmations: 0,
};
const inBlock = (confirmations: number) => ({
  state: "IN_BLOCK" as const,
  blockNumber: BigInt(1),
  confirmations,
});

// Apply a plan to the deal the way the watcher does.
function apply(deal: PlanDeal, plan: DealPlan): PlanDeal {
  let next = { ...deal };
  for (const s of plan.steps)
    next = {
      ...next,
      status: s.to,
      depositSeenAt: s.set.depositSeenAt ?? next.depositSeenAt,
      confirmations: s.set.confirmations ?? next.confirmations,
    };
  if (plan.confirmations !== null) next.confirmations = plan.confirmations;
  return next;
}

describe("planDeal", () => {
  it("moves to seen with the confirmations so far", () => {
    const plan = planDeal(base, { transfer, proof: inBlock(12) }, 19, at(6));
    expect(plan.steps.map((s) => s.to)).toEqual(["DEPOSIT_SEEN"]);
    expect(plan.steps[0]!.set).toMatchObject({
      confirmations: 12,
      txHash: "c7bd",
    });
  });

  it("goes seen → complete in one run when already confirmed, with the payout timer", () => {
    const plan = planDeal(base, { transfer, proof: inBlock(19) }, 19, at(6));
    expect(plan.steps.map((s) => s.to)).toEqual([
      "DEPOSIT_SEEN",
      "DEPOSIT_COMPLETE",
    ]);
    expect(plan.steps[1]!.set.payoutDueAt).toEqual(at(16));
  });

  it("is idempotent: a second run after applying does nothing", () => {
    const run1 = planDeal(base, { transfer, proof: inBlock(19) }, 19, at(6));
    const after = apply(base, run1);
    expect(after.status).toBe("DEPOSIT_COMPLETE");
    expect(
      planDeal(after, { transfer, proof: inBlock(25) }, 19, at(7)),
    ).toEqual({
      steps: [],
      confirmations: null,
      note: null,
    });

    const seen = apply(
      base,
      planDeal(base, { transfer, proof: inBlock(12) }, 19, at(6)),
    );
    expect(
      planDeal(seen, { transfer, proof: inBlock(12) }, 19, at(6)).steps,
    ).toEqual([]);
    // A new count is a quiet update, then nothing.
    const tick = planDeal(seen, { transfer, proof: inBlock(15) }, 19, at(6));
    expect(tick).toEqual({ steps: [], confirmations: 15, note: null });
    expect(
      planDeal(apply(seen, tick), { transfer, proof: inBlock(15) }, 19, at(6))
        .confirmations,
    ).toBeNull();
  });

  it("flags an underpayment, a wrong token and a failed transaction", () => {
    for (const [linked, reason] of [
      [
        { transfer: { ...transfer, amount: "500" }, proof: inBlock(19) },
        "underpaid: received 500 of 500.37 USDT",
      ],
      [
        { transfer: { ...transfer, tokenContract: FAKE }, proof: inBlock(19) },
        "wrong token: not the official USDT contract",
      ],
      [
        {
          transfer,
          proof: {
            state: "FAILED" as const,
            reason: "the transaction failed on-chain",
          },
        },
        "the transaction failed on-chain",
      ],
    ] as const) {
      const plan = planDeal(base, linked, 19, at(6));
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0]).toMatchObject({
        to: "FLAGGED",
        set: { flagReason: reason },
      });
    }
  });

  it("flags a wrong-network transfer", () => {
    const plan = planDeal(
      base,
      { transfer: { ...transfer, network: "BEP20" }, proof: inBlock(19) },
      19,
      at(6),
    );
    expect(plan.steps[0]).toMatchObject({
      to: "FLAGGED",
      set: { flagReason: "wrong network" },
    });
  });

  it("expires a late deposit, never completes it", () => {
    const late = { ...transfer, blockTime: at(31) };
    const plan = planDeal(
      base,
      { transfer: late, proof: inBlock(19) },
      19,
      at(32),
    );
    expect(plan.steps.map((s) => s.to)).toEqual(["EXPIRED"]);
  });

  it("expires a deal whose lock ended with no deposit", () => {
    expect(planDeal(base, null, 19, at(29)).steps).toEqual([]);
    expect(planDeal(base, null, 19, at(31)).steps.map((s) => s.to)).toEqual([
      "EXPIRED",
    ]);
  });

  it("applies a pasted-TxID flag before any check", () => {
    const plan = planDeal(
      base,
      { transfer, proof: inBlock(19) },
      19,
      at(6),
      "pasted TxID: older",
    );
    expect(plan.steps.map((s) => s.to)).toEqual(["FLAGGED"]);
  });

  it("flags a deposit seen for over an hour without confirming", () => {
    const seen = {
      ...base,
      status: "DEPOSIT_SEEN" as const,
      depositSeenAt: at(6),
      confirmations: 3,
    };
    expect(
      planDeal(seen, { transfer, proof: inBlock(3) }, 19, at(60)).steps,
    ).toEqual([]);
    expect(
      planDeal(seen, { transfer, proof: inBlock(3) }, 19, at(67)).steps[0]!.to,
    ).toBe("FLAGGED");
  });

  it("notes a late deposit on an expired deal without moving it", () => {
    const expired = { ...base, status: "EXPIRED" as const };
    expect(
      planDeal(expired, { transfer, proof: inBlock(19) }, 19, at(40)),
    ).toEqual({
      steps: [],
      confirmations: null,
      note: "Late deposit seen: 500.37 USDT",
    });
  });

  it("never touches a finished deal", () => {
    for (const status of [
      "DEPOSIT_COMPLETE",
      "PAID_OUT",
      "FLAGGED",
      "CANCELLED",
    ] as const)
      expect(
        planDeal(
          { ...base, status },
          { transfer, proof: inBlock(19) },
          19,
          at(6),
        ).steps,
      ).toEqual([]);
  });
});
