-- AlterEnum
ALTER TYPE "RateBoardType" ADD VALUE 'CRYPTO';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "defaultCryptoTemplateKey" TEXT;

-- CreateTable
CREATE TABLE "Coin" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "networks" TEXT[],
    "iconUrl" TEXT,
    "badgeColor" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoRate" (
    "id" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,
    "buy" DECIMAL(14,4) NOT NULL,
    "sell" DECIMAL(14,4) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CryptoRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Coin_organizationId_status_sortOrder_idx" ON "Coin"("organizationId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Coin_organizationId_ticker_key" ON "Coin"("organizationId", "ticker");

-- CreateIndex
CREATE INDEX "CryptoRate_coinId_createdAt_idx" ON "CryptoRate"("coinId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Coin" ADD CONSTRAINT "Coin_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoRate" ADD CONSTRAINT "CryptoRate_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-added CHECK constraint (Prisma cannot express it in the schema).
-- Same rule as forex_sell_gte_buy: sell is never below buy.
ALTER TABLE "CryptoRate" ADD CONSTRAINT "crypto_sell_gte_buy" CHECK ("sell" >= "buy");
