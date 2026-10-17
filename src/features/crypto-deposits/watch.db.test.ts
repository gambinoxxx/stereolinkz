// The deposit watcher on a DEVELOPMENT database, with a fake provider.
// Opt-in: DEAL_DB_TESTS=1 npx vitest run src/features/crypto-deposits/watch.db.test.ts
// Refuses to run against the production endpoint.
import { randomBytes } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type {
  DepositProvider,
  IncomingTransfer,
  TransferProof,
} from "@/features/crypto-deposits/providers/types";

config({ path: [".env.local"], quiet: true });

const PROD_HOST = "ep-twilight-brook";
const enabled =
  process.env.DEAL_DB_TESTS === "1" &&
  !!process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes(PROD_HOST);

const ADDRESS = "THPvaUhoh2Qn2y9THCZML3H815hhFhn5YC";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const FAKE = "TY2G6iSCd7tyUfYYdjFZ1oVbsohavB1vSh";

function fakeProvider(
  transfers: IncomingTransfer[],
  confirmations: number,
): DepositProvider {
  return {
    network: "TRC20",
    listIncomingTransfers: async () => transfers,
    getProof: async (): Promise<TransferProof> => ({
      state: "IN_BLOCK",
      blockNumber: BigInt(100),
      confirmations,
    }),
  };
}

describe.skipIf(!enabled)(
  "deposit watcher on the database",
  { timeout: 60_000 },
  async () => {
    const { db } = await import("@/lib/server/db");
    const { checkDeposits } = await import("@/features/crypto-deposits/watch");
    let organizationId = "";
    let walletId = "";
    const deals: Record<string, string> = {};
    const t0 = new Date(Date.now() - 10 * 60_000);
    const at = (min: number) => new Date(t0.getTime() + min * 60_000);
    const tx = () => randomBytes(32).toString("hex");

    const transfer = (
      amount: string,
      more: Partial<IncomingTransfer> = {},
    ) => ({
      network: "TRC20" as const,
      txHash: tx(),
      logIndex: 0,
      fromAddress: "TZ4hBM3vSND8KAuJvTFWUrRy58TMxCeuFu",
      toAddress: ADDRESS,
      tokenContract: USDT,
      amount,
      blockTime: at(2),
      ...more,
    });

    beforeAll(async () => {
      organizationId = (
        await db.organization.findFirstOrThrow({ select: { id: true } })
      ).id;
      // A test wallet; an inactive one so it never clashes with a real one.
      walletId = (
        await db.cryptoWallet.create({
          data: {
            organizationId,
            ticker: "USDT",
            network: "TRC20",
            address: ADDRESS,
            minConfirmations: 19,
            active: false,
          },
        })
      ).id;
      const make = async (key: string, expectedQty: string) => {
        const d = await db.deal.create({
          data: {
            organizationId,
            ref: `TST-${randomBytes(3).toString("hex")}`,
            service: "CRYPTO_SELL",
            status: "AWAITING_DEPOSIT",
            customerName: "Test",
            customerWhatsapp: "+2348000000000",
            details: {
              service: "CRYPTO_SELL",
              ticker: "USDT",
              network: "TRC20",
              payoutNameCheck: "MATCH",
            },
            currency: "USDT",
            amount: expectedQty,
            cryptoTicker: "USDT",
            cryptoNetwork: "TRC20",
            depositAddress: ADDRESS,
            walletId,
            expectedQty,
            lockExpiresAt: at(30),
            trackingTokenHash: "0".repeat(64),
            createdAt: t0,
          },
        });
        deals[key] = d.id;
      };
      await make("good", "500.37");
      await make("under", "300.11");
      await make("fake", "200.22");
      await make("idle", "100.33");
    });

    afterAll(async () => {
      const ids = Object.values(deals);
      await db.observedTransfer.deleteMany({ where: { walletId } });
      await db.deal.deleteMany({ where: { id: { in: ids } } });
      await db.cryptoWallet.delete({ where: { id: walletId } });
      await db.$disconnect();
    });

    it("two runs at once move each deal exactly once", async () => {
      const provider = fakeProvider(
        [
          transfer("500.37"),
          transfer("300.1", { blockTime: at(3) }), // underpaid: no amount match
          transfer("200.22", { tokenContract: FAKE }), // wrong token
        ],
        19,
      );
      const now = at(8);
      const [a, b] = await Promise.all([
        checkDeposits(walletId, { provider, now }),
        checkDeposits(walletId, { provider, now }),
      ]);
      expect([...a.completed, ...b.completed]).toEqual([deals.good]);

      const good = await db.deal.findUniqueOrThrow({
        where: { id: deals.good },
        include: { events: true },
      });
      expect(good.status).toBe("DEPOSIT_COMPLETE");
      expect(good.receivedQty?.toFixed()).toBe("500.37");
      expect(good.payoutDueAt).not.toBeNull();
      expect(
        good.events
          .filter((e) => e.type === "STATUS_CHANGED")
          .map((e) => e.toStatus),
      ).toEqual(["DEPOSIT_SEEN", "DEPOSIT_COMPLETE"]);

      // No exact-amount transfer and no fake-token match: still waiting.
      for (const key of ["under", "fake", "idle"])
        expect(
          (await db.deal.findUniqueOrThrow({ where: { id: deals[key] } }))
            .status,
        ).toBe("AWAITING_DEPOSIT");
      expect(await db.observedTransfer.count({ where: { walletId } })).toBe(3);
    });

    it("a pasted TxID links the underpaid transfer, and the check flags it", async () => {
      const row = await db.observedTransfer.findFirstOrThrow({
        where: { walletId, amount: "300.1" },
      });
      const provider = fakeProvider([], 19);
      const r = await checkDeposits(walletId, {
        provider,
        now: at(9),
        claim: { dealId: deals.under!, txHash: row.txHash },
      });
      expect(r.claim).toBe("LINKED");
      const under = await db.deal.findUniqueOrThrow({
        where: { id: deals.under },
      });
      expect(under.status).toBe("FLAGGED");
      expect(under.flagReason).toBe("underpaid: received 300.1 of 300.11 USDT");
    });

    it("a pasted TxID of the wrong token is flagged, never confirmed", async () => {
      const row = await db.observedTransfer.findFirstOrThrow({
        where: { walletId, tokenContract: FAKE },
      });
      const r = await checkDeposits(walletId, {
        provider: fakeProvider([], 19),
        now: at(9),
        claim: { dealId: deals.fake!, txHash: row.txHash },
      });
      expect(r.claim).toBe("LINKED");
      const fake = await db.deal.findUniqueOrThrow({
        where: { id: deals.fake },
      });
      expect(fake.status).toBe("FLAGGED");
      expect(fake.flagReason).toContain("wrong token");
    });

    it("someone else's TxID can't be claimed", async () => {
      const row = await db.observedTransfer.findFirstOrThrow({
        where: { walletId, amount: "500.37" },
      });
      const r = await checkDeposits(walletId, {
        provider: fakeProvider([], 19),
        now: at(9),
        claim: { dealId: deals.idle!, txHash: row.txHash },
      });
      expect(r.claim).toBe("TAKEN");
    });

    it("expires the idle deal once its lock has passed", async () => {
      await checkDeposits(walletId, {
        provider: fakeProvider([], 19),
        now: at(31),
      });
      const idle = await db.deal.findUniqueOrThrow({
        where: { id: deals.idle },
      });
      expect(idle.status).toBe("EXPIRED");
    });
  },
);
