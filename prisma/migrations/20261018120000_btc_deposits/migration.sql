ALTER TYPE "CryptoNetwork" ADD VALUE 'BTC';
ALTER TYPE "CryptoNetwork" ADD VALUE 'ETH';
ALTER TYPE "DealStatus" ADD VALUE 'RATE_TO_AGREE';
ALTER TABLE "Deal" ADD COLUMN     "confirmPrice" DECIMAL(24,8),
ADD COLUMN     "feeUsd" DECIMAL(18,2),
ADD COLUMN     "payoutUsd" DECIMAL(18,2),
ADD COLUMN     "quotePrice" DECIMAL(24,8),
ADD COLUMN     "quoteUsd" DECIMAL(18,2);
ALTER TABLE "Organization" ADD COLUMN     "cryptoMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 1.5,
ADD COLUMN     "cryptoMinFeeUsd" DECIMAL(10,2) NOT NULL DEFAULT 2;

-- ── Hand-written guards (Phase 13b) ─────────────────────────────────────

ALTER TABLE "Organization" ADD CONSTRAINT "org_crypto_margin" CHECK (
  "cryptoMarginPct" >= 0 AND "cryptoMarginPct" <= 20 AND "cryptoMinFeeUsd" >= 0
);
ALTER TABLE "Deal" ADD CONSTRAINT "deal_market_quote" CHECK (
  ("quoteUsd" IS NULL OR "quoteUsd" > 0)
  AND ("feeUsd" IS NULL OR "feeUsd" >= 0)
  AND ("payoutUsd" IS NULL OR "payoutUsd" > 0)
  AND ("quotePrice" IS NULL OR "quotePrice" > 0)
  AND ("confirmPrice" IS NULL OR "confirmPrice" > 0)
);

-- The dollar quote of a market-priced deal never changes once set (like
-- quotedRate); confirmPrice is recorded later by the watcher.
CREATE FUNCTION "deal_market_quote_immutable"() RETURNS trigger AS $$
BEGIN
  IF (OLD."quoteUsd" IS NOT NULL AND NEW."quoteUsd" IS DISTINCT FROM OLD."quoteUsd")
     OR (OLD."feeUsd" IS NOT NULL AND NEW."feeUsd" IS DISTINCT FROM OLD."feeUsd")
     OR (OLD."payoutUsd" IS NOT NULL AND NEW."payoutUsd" IS DISTINCT FROM OLD."payoutUsd")
     OR (OLD."quotePrice" IS NOT NULL AND NEW."quotePrice" IS DISTINCT FROM OLD."quotePrice") THEN
    RAISE EXCEPTION 'deal_market_quote_immutable: the dollar quote of a deal never changes'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "deal_market_quote_immutable"
  BEFORE UPDATE ON "Deal"
  FOR EACH ROW EXECUTE FUNCTION "deal_market_quote_immutable"();
