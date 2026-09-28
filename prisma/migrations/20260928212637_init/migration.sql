-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RateBoardType" AS ENUM ('FOREX', 'POF', 'CUSTOM');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "clerkOrgId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "quoteCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "logoUrl" TEXT,
    "backgroundColor" TEXT,
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "contactLine" TEXT,
    "email" TEXT,
    "defaultFinePrint" TEXT,
    "defaultForexTemplateKey" TEXT,
    "defaultPofTemplateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "flagCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForexRate" (
    "id" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "buy" DECIMAL(14,4) NOT NULL,
    "sell" DECIMAL(14,4) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForexRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "pofActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PofRate" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PofRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateBoard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "RateBoardType" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateBoardImage" (
    "id" TEXT NOT NULL,
    "rateBoardId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateBoardImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_clerkOrgId_key" ON "Organization"("clerkOrgId");

-- CreateIndex
CREATE INDEX "Membership_clerkUserId_idx" ON "Membership"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_clerkUserId_key" ON "Membership"("organizationId", "clerkUserId");

-- CreateIndex
CREATE INDEX "Currency_organizationId_status_sortOrder_idx" ON "Currency"("organizationId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_organizationId_code_key" ON "Currency"("organizationId", "code");

-- CreateIndex
CREATE INDEX "ForexRate_currencyId_createdAt_idx" ON "ForexRate"("currencyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Bank_organizationId_status_sortOrder_idx" ON "Bank"("organizationId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_organizationId_slug_key" ON "Bank"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "PofRate_bankId_createdAt_idx" ON "PofRate"("bankId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RateBoard_organizationId_createdAt_idx" ON "RateBoard"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RateBoard_organizationId_type_createdAt_idx" ON "RateBoard"("organizationId", "type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RateBoardImage_rateBoardId_createdAt_idx" ON "RateBoardImage"("rateBoardId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForexRate" ADD CONSTRAINT "ForexRate_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bank" ADD CONSTRAINT "Bank_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PofRate" ADD CONSTRAINT "PofRate_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateBoard" ADD CONSTRAINT "RateBoard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateBoardImage" ADD CONSTRAINT "RateBoardImage_rateBoardId_fkey" FOREIGN KEY ("rateBoardId") REFERENCES "RateBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-added CHECK constraints (Prisma cannot express these in the schema)
ALTER TABLE "ForexRate" ADD CONSTRAINT forex_sell_gte_buy CHECK (sell >= buy);
ALTER TABLE "PofRate"  ADD CONSTRAINT pof_rate_range CHECK (rate >= 0 AND rate <= 100);
