
-- CreateEnum
CREATE TYPE "CryptoNetwork" AS ENUM ('TRC20', 'BEP20');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DealEventType" ADD VALUE 'DEPOSIT_UPDATE';
ALTER TYPE "DealEventType" ADD VALUE 'TXID_SUBMITTED';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "confirmations" INTEGER,
ADD COLUMN     "cryptoNetwork" "CryptoNetwork",
ADD COLUMN     "cryptoTicker" TEXT,
ADD COLUMN     "depositAddress" TEXT,
ADD COLUMN     "depositCompletedAt" TIMESTAMP(3),
ADD COLUMN     "depositSeenAt" TIMESTAMP(3),
ADD COLUMN     "expectedQty" DECIMAL(38,18),
ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "lastDepositCheckAt" TIMESTAMP(3),
ADD COLUMN     "lockExpiresAt" TIMESTAMP(3),
ADD COLUMN     "payoutDueAt" TIMESTAMP(3),
ADD COLUMN     "payoutOverdueAlertAt" TIMESTAMP(3),
ADD COLUMN     "receivedQty" DECIMAL(38,18),
ADD COLUMN     "txHash" TEXT,
ADD COLUMN     "walletId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "cryptoMaxUsd" DECIMAL(18,2) NOT NULL DEFAULT 5000,
ADD COLUMN     "cryptoMinQty" DECIMAL(18,2) NOT NULL DEFAULT 20,
ADD COLUMN     "payoutAlertEmails" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CryptoWallet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "network" "CryptoNetwork" NOT NULL,
    "address" TEXT NOT NULL,
    "minConfirmations" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "CryptoWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservedTransfer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "network" "CryptoNetwork" NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "tokenContract" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "blockNumber" BIGINT,
    "blockTime" TIMESTAMP(3) NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "matchedDealId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservedTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CryptoWallet_organizationId_active_idx" ON "CryptoWallet"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ObservedTransfer_matchedDealId_key" ON "ObservedTransfer"("matchedDealId");

-- CreateIndex
CREATE INDEX "ObservedTransfer_walletId_blockTime_idx" ON "ObservedTransfer"("walletId", "blockTime");

-- CreateIndex
CREATE INDEX "ObservedTransfer_organizationId_matchedDealId_idx" ON "ObservedTransfer"("organizationId", "matchedDealId");

-- CreateIndex
CREATE UNIQUE INDEX "ObservedTransfer_network_txHash_logIndex_key" ON "ObservedTransfer"("network", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "Deal_walletId_status_idx" ON "Deal"("walletId", "status");

-- AddForeignKey
ALTER TABLE "CryptoWallet" ADD CONSTRAINT "CryptoWallet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservedTransfer" ADD CONSTRAINT "ObservedTransfer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservedTransfer" ADD CONSTRAINT "ObservedTransfer_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CryptoWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservedTransfer" ADD CONSTRAINT "ObservedTransfer_matchedDealId_fkey" FOREIGN KEY ("matchedDealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CryptoWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Hand-written guards (Phase 13) ──────────────────────────────────────

-- At most one active wallet per coin and network.
CREATE UNIQUE INDEX "CryptoWallet_one_active" ON "CryptoWallet"("organizationId", "ticker", "network") WHERE "active";

ALTER TABLE "CryptoWallet" ADD CONSTRAINT "crypto_wallet_confirmations" CHECK ("minConfirmations" BETWEEN 1 AND 200);
ALTER TABLE "Organization" ADD CONSTRAINT "org_crypto_limits_positive" CHECK ("cryptoMinQty" > 0 AND "cryptoMaxUsd" > 0);
ALTER TABLE "Deal" ADD CONSTRAINT "deal_crypto_quantities" CHECK (
  ("expectedQty" IS NULL OR "expectedQty" > 0)
  AND ("receivedQty" IS NULL OR "receivedQty" >= 0)
  AND ("confirmations" IS NULL OR "confirmations" >= 0)
);
ALTER TABLE "ObservedTransfer" ADD CONSTRAINT "observed_transfer_amount" CHECK ("amount" >= 0 AND "confirmations" >= 0);

-- A wallet's coin, network and address never change: a new address is a
-- new wallet, so the address a deal showed is always on record.
CREATE FUNCTION "crypto_wallet_address_immutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."ticker" IS DISTINCT FROM OLD."ticker"
     OR NEW."network" IS DISTINCT FROM OLD."network"
     OR NEW."address" IS DISTINCT FROM OLD."address" THEN
    RAISE EXCEPTION 'crypto_wallet_address_immutable: add a new wallet instead'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "crypto_wallet_address_immutable"
  BEFORE UPDATE ON "CryptoWallet"
  FOR EACH ROW EXECUTE FUNCTION "crypto_wallet_address_immutable"();

-- The deposit details a deal showed the customer never change once set.
CREATE FUNCTION "deal_deposit_immutable"() RETURNS trigger AS $$
BEGIN
  IF (OLD."depositAddress" IS NOT NULL AND NEW."depositAddress" IS DISTINCT FROM OLD."depositAddress")
     OR (OLD."cryptoNetwork" IS NOT NULL AND NEW."cryptoNetwork" IS DISTINCT FROM OLD."cryptoNetwork")
     OR (OLD."cryptoTicker" IS NOT NULL AND NEW."cryptoTicker" IS DISTINCT FROM OLD."cryptoTicker")
     OR (OLD."walletId" IS NOT NULL AND NEW."walletId" IS DISTINCT FROM OLD."walletId") THEN
    RAISE EXCEPTION 'deal_deposit_immutable: the deposit address of a deal never changes'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "deal_deposit_immutable"
  BEFORE UPDATE ON "Deal"
  FOR EACH ROW EXECUTE FUNCTION "deal_deposit_immutable"();
