import { describe, expect, it } from "vitest";

import { checkDeposit } from "@/features/crypto-deposits/check";

const ADDRESS = "THPvaUhoh2Qn2y9THCZML3H815hhFhn5YC";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const FAKE = "TY2G6iSCd7tyUfYYdjFZ1oVbsohavB1vSh";

const deal = {
  network: "TRC20" as const,
  ticker: "USDT",
  depositAddress: ADDRESS,
  expectedQty: "500.37",
  lockExpiresAt: new Date("2026-10-17T10:30:00Z"),
};
const transfer = {
  network: "TRC20" as const,
  toAddress: ADDRESS,
  tokenContract: USDT,
  amount: "500.37",
  blockTime: new Date("2026-10-17T10:12:00Z"),
  confirmations: 19,
};
const ALL_PASS = {
  destination: true,
  contract: true,
  network: true,
  amount: true,
  confirmations: true,
  lock: true,
};

describe("checkDeposit", () => {
  it("completes only when all six checks pass", () => {
    expect(checkDeposit(deal, transfer, 19)).toEqual({
      checks: ALL_PASS,
      verdict: { outcome: "COMPLETE", overpaidBy: null },
    });
  });

  it("waits (seen) while confirmations are below the minimum", () => {
    const r = checkDeposit(deal, { ...transfer, confirmations: 12 }, 19);
    expect(r.checks.confirmations).toBe(false);
    expect(r.verdict).toEqual({ outcome: "SEEN" });
  });

  it("flags an underpayment with what arrived", () => {
    const r = checkDeposit(deal, { ...transfer, amount: "500.36" }, 19);
    expect(r.checks.amount).toBe(false);
    expect(r.verdict).toEqual({
      outcome: "FLAGGED",
      reason: "underpaid: received 500.36 of 500.37 USDT",
    });
  });

  it("completes an overpayment and notes it for the team", () => {
    const r = checkDeposit(deal, { ...transfer, amount: "510" }, 19);
    expect(r.verdict).toEqual({ outcome: "COMPLETE", overpaidBy: "9.63" });
  });

  it("expires a late deposit (the team re-quotes)", () => {
    const r = checkDeposit(
      deal,
      { ...transfer, blockTime: new Date("2026-10-17T10:30:01Z") },
      19,
    );
    expect(r.checks.lock).toBe(false);
    expect(r.verdict.outcome).toBe("EXPIRED");
  });

  it("accepts a deposit in the lock's last second", () => {
    const r = checkDeposit(
      deal,
      { ...transfer, blockTime: deal.lockExpiresAt },
      19,
    );
    expect(r.verdict.outcome).toBe("COMPLETE");
  });

  it("flags the wrong token, even with the right amount", () => {
    const r = checkDeposit(deal, { ...transfer, tokenContract: FAKE }, 19);
    expect(r.checks.contract).toBe(false);
    expect(r.verdict).toMatchObject({ outcome: "FLAGGED" });
    expect(r.verdict).toHaveProperty(
      "reason",
      "wrong token: not the official USDT contract",
    );
  });

  it("flags the wrong network", () => {
    const r = checkDeposit(deal, { ...transfer, network: "BEP20" }, 19);
    expect(r.checks.network).toBe(false);
    expect(r.verdict).toEqual({ outcome: "FLAGGED", reason: "wrong network" });
  });

  it("flags a transfer to another address", () => {
    const r = checkDeposit(deal, { ...transfer, toAddress: USDT }, 19);
    expect(r.checks.destination).toBe(false);
    expect(r.verdict.outcome).toBe("FLAGGED");
  });

  it("flags rather than waits when a failure and low confirmations combine", () => {
    const r = checkDeposit(
      deal,
      { ...transfer, tokenContract: FAKE, confirmations: 0 },
      19,
    );
    expect(r.verdict.outcome).toBe("FLAGGED");
  });

  it("never completes when any single check fails", () => {
    const breaks = [
      { toAddress: USDT },
      { tokenContract: FAKE },
      { network: "BEP20" as const },
      { amount: "1" },
      { confirmations: 18 },
      { blockTime: new Date("2026-10-17T11:00:00Z") },
    ];
    for (const b of breaks)
      expect(
        checkDeposit(deal, { ...transfer, ...b }, 19).verdict.outcome,
      ).not.toBe("COMPLETE");
  });
});
