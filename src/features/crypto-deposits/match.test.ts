import { describe, expect, it } from "vitest";

import {
  claimByTxId,
  matchByAmount,
  type MatchDeal,
  type MatchTransfer,
} from "@/features/crypto-deposits/match";

const ADDRESS = "THPvaUhoh2Qn2y9THCZML3H815hhFhn5YC";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const FAKE = "TY2G6iSCd7tyUfYYdjFZ1oVbsohavB1vSh";
const T0 = new Date("2026-10-17T10:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);

const deal = (
  id: string,
  expectedQty: string,
  more: Partial<MatchDeal> = {},
): MatchDeal => ({
  id,
  status: "AWAITING_DEPOSIT",
  network: "TRC20",
  ticker: "USDT",
  depositAddress: ADDRESS,
  expectedQty,
  createdAt: T0,
  hasTransfer: false,
  ...more,
});
const transfer = (
  id: string,
  amount: string,
  more: Partial<MatchTransfer> = {},
): MatchTransfer => ({
  id,
  network: "TRC20",
  toAddress: ADDRESS,
  tokenContract: USDT,
  amount,
  blockTime: at(5),
  matchedDealId: null,
  ...more,
});

describe("matchByAmount", () => {
  it("links each deal to the transfer of exactly its amount", () => {
    expect(
      matchByAmount(
        [deal("a", "500.00"), deal("b", "500.37")],
        [transfer("t1", "500.37"), transfer("t2", "500")],
      ),
    ).toEqual({
      links: [
        { dealId: "a", transferId: "t2" },
        { dealId: "b", transferId: "t1" },
      ],
      ambiguous: [],
    });
  });

  it("ignores near amounts, other tokens, other addresses and older transfers", () => {
    const got = matchByAmount(
      [deal("a", "500.37")],
      [
        transfer("near", "500.36"),
        transfer("fake", "500.37", { tokenContract: FAKE }),
        transfer("other", "500.37", { toAddress: USDT }),
        transfer("old", "500.37", { blockTime: at(-1) }),
        transfer("taken", "500.37", { matchedDealId: "z" }),
      ],
    );
    expect(got).toEqual({ links: [], ambiguous: [] });
  });

  it("flags a deal with two candidate transfers (ambiguous)", () => {
    expect(
      matchByAmount(
        [deal("a", "500.37")],
        [
          transfer("t1", "500.37"),
          transfer("t2", "500.37", { blockTime: at(6) }),
        ],
      ),
    ).toEqual({ links: [], ambiguous: [{ dealId: "a", count: 2 }] });
  });

  it("flags two deals that could both take one transfer (ambiguous)", () => {
    expect(
      matchByAmount(
        [deal("a", "500.37"), deal("b", "500.37")],
        [transfer("t1", "500.37")],
      ),
    ).toEqual({
      links: [],
      ambiguous: [
        { dealId: "a", count: 1 },
        { dealId: "b", count: 1 },
      ],
    });
  });

  it("skips deals that already have a transfer, and links late ones to expired deals", () => {
    const got = matchByAmount(
      [
        deal("seen", "500.37", { status: "DEPOSIT_SEEN", hasTransfer: true }),
        deal("late", "300.00", { status: "EXPIRED" }),
        deal("done", "200.00", { status: "PAID_OUT" }),
      ],
      [transfer("t1", "500.37"), transfer("t2", "300"), transfer("t3", "200")],
    );
    expect(got.links).toEqual([{ dealId: "late", transferId: "t2" }]);
  });
});

describe("claimByTxId", () => {
  it("links the pasted transfer when it is the deal's exact amount", () => {
    expect(
      claimByTxId(deal("a", "500.37"), transfer("t1", "500.37"), []),
    ).toEqual({
      ok: true,
      flagReason: null,
    });
  });

  it("leaves a transfer that fits another waiting deal to that deal", () => {
    expect(
      claimByTxId(deal("a", "20.00"), transfer("t1", "1000.00"), [
        deal("b", "1000.00"),
      ]),
    ).toEqual({ ok: false, reason: "TAKEN" });
  });

  it("refuses a transfer already linked elsewhere", () => {
    expect(
      claimByTxId(
        deal("a", "500.37"),
        transfer("t1", "500.37", { matchedDealId: "b" }),
        [],
      ),
    ).toEqual({ ok: false, reason: "TAKEN" });
  });

  it("flags an overpaid paste instead of completing it", () => {
    const got = claimByTxId(deal("a", "20.00"), transfer("t1", "1000"), []);
    expect(got).toMatchObject({ ok: true });
    expect(got.ok && got.flagReason).toContain(
      "more than the 20.00 USDT expected",
    );
  });

  it("flags a paste older than the deal", () => {
    const got = claimByTxId(
      deal("a", "500.37"),
      transfer("t1", "500.37", { blockTime: at(-30) }),
      [],
    );
    expect(got.ok && got.flagReason).toContain("older than this deal");
  });

  it("lets the deposit check judge a wrong-token or underpaid paste", () => {
    expect(
      claimByTxId(
        deal("a", "500.37"),
        transfer("t1", "500.37", { tokenContract: FAKE }),
        [],
      ),
    ).toEqual({ ok: true, flagReason: null });
    expect(claimByTxId(deal("a", "500.37"), transfer("t1", "100"), [])).toEqual(
      {
        ok: true,
        flagReason: null,
      },
    );
  });

  it("refuses when the deal already has its transfer", () => {
    expect(
      claimByTxId(
        deal("a", "500.37", { hasTransfer: true }),
        transfer("t1", "500.37"),
        [],
      ),
    ).toEqual({ ok: false, reason: "HAS_TRANSFER" });
  });
});
