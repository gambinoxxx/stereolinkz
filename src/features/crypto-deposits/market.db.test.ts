// BTC deal creation on a DEVELOPMENT database (Phase 13b). Opt-in:
// DEAL_DB_TESTS=1 npx vitest run src/features/crypto-deposits/market.db.test.ts
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: [".env.local"], quiet: true });

const PROD_HOST = "ep-twilight-brook";
const enabled =
  process.env.DEAL_DB_TESTS === "1" &&
  !!process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes(PROD_HOST);

describe.skipIf(!enabled)(
  "BTC deals on the database",
  { timeout: 60_000 },
  async () => {
    const { db } = await import("@/lib/server/db");
    const { createDeal } = await import("@/features/deals/create");
    const { marketQuote } =
      await import("@/features/crypto-deposits/market-quote");
    const created: string[] = [];
    let organizationId = "";
    let walletId = "";

    beforeAll(async () => {
      organizationId = (
        await db.organization.findFirstOrThrow({ select: { id: true } })
      ).id;
      walletId = (
        await db.cryptoWallet.create({
          data: {
            organizationId,
            ticker: "BTC",
            network: "BTC",
            address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
            minConfirmations: 2,
            active: false, // never clashes with a real wallet
          },
        })
      ).id;
    });

    afterAll(async () => {
      await db.deal.deleteMany({ where: { id: { in: created } } });
      await db.cryptoWallet.delete({ where: { id: walletId } });
      await db.$disconnect();
    });

    const quote = marketQuote({
      usd: "400",
      priceUsd: "81355",
      marginPct: "1.5",
      minFeeUsd: "2",
      rate: "1330",
      decimals: 8,
    })!;
    const newBtcDeal = () =>
      createDeal({
        organizationId,
        service: "CRYPTO_SELL",
        customer: { name: "Test BTC", whatsapp: "+2348000000001" },
        details: {
          service: "CRYPTO_SELL",
          ticker: "BTC",
          network: "BTC",
          payoutNameCheck: "MATCH",
        },
        currency: "BTC",
        amount: quote.coins,
        quote: null,
        ownerMembershipId: null,
        trackingTokenHash: "0".repeat(64),
        ipHash: null,
        actor: { type: "SYSTEM" },
        message: "Database test",
        crypto: {
          walletId,
          ticker: "BTC",
          network: "BTC",
          depositAddress: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
          rate: "1330",
          boardId: "test-board",
          timeLabel: "10:25 AM",
          lockMinutes: 30,
          market: {
            quoteUsd: quote.quoteUsd,
            feeUsd: quote.feeUsd,
            payoutUsd: quote.payoutUsd,
            priceUsd: "81355",
          },
        },
      });

    it("gives parallel deals for the same dollars different exact amounts", async () => {
      const deals = await Promise.all([
        newBtcDeal(),
        newBtcDeal(),
        newBtcDeal(),
      ]);
      created.push(...deals.map((d) => d.id));
      const rows = await db.deal.findMany({
        where: { id: { in: created } },
        select: {
          expectedQty: true,
          amount: true,
          quoteUsd: true,
          payoutUsd: true,
          quotedNaira: true,
          status: true,
        },
      });
      const amounts = rows.map((r) => r.expectedQty!.toFixed());
      expect(new Set(amounts).size).toBe(3);
      for (const r of rows) {
        // base 0.00491672 BTC + 1…999 satoshis, kept to 8 decimals in amount too
        expect(
          Number(r.expectedQty) > 0.00491672 &&
            Number(r.expectedQty) <= 0.00492671,
        ).toBe(true);
        expect(r.amount.toFixed()).toBe(r.expectedQty!.toFixed());
        expect(r.status).toBe("AWAITING_DEPOSIT");
        expect(r.quoteUsd?.toFixed()).toBe("400");
        expect(r.payoutUsd?.toFixed()).toBe("394");
        expect(r.quotedNaira?.toFixed()).toBe("524020"); // payout $394 × ₦1,330
      }
    });

    it("never lets the dollar quote change", async () => {
      await expect(
        db.deal.update({
          where: { id: created[0] },
          data: { payoutUsd: "500" },
        }),
      ).rejects.toThrow(/deal_market_quote_immutable/);
      // confirmPrice is the one market field set later.
      await db.deal.update({
        where: { id: created[0] },
        data: { confirmPrice: "80500" },
      });
    });
  },
);
