-- CreateEnum
CREATE TYPE "DealService" AS ENUM ('SCHOOL_FEES', 'INTL_PAYMENT', 'POF', 'FOREX_SELL', 'FOREX_BUY', 'CRYPTO_SELL');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('NEW', 'AGREED', 'AWAITING_PAYMENT', 'PAYMENT_RECEIVED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'AWAITING_DEPOSIT', 'DEPOSIT_SEEN', 'DEPOSIT_COMPLETE', 'PAID_OUT', 'EXPIRED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "DealActor" AS ENUM ('MEMBER', 'CUSTOMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DealEventType" AS ENUM ('REQUESTED', 'STATUS_CHANGED', 'RATE_AGREED', 'RATE_CHANGED', 'PAYMENT_DETAILS_SHARED', 'CUSTOMER_PAID', 'FILE_UPLOADED', 'OWNER_CHANGED', 'NOTE', 'ALERT_SENT');

-- CreateEnum
CREATE TYPE "DealFileKind" AS ENUM ('INVOICE', 'RECEIPT', 'CONFIRMATION', 'OTHER');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "contactSlaMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "dealAlertEmails" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dealDefaultOwnerId" TEXT,
ADD COLUMN     "dealRefCounter" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "dealRefPrefix" TEXT NOT NULL DEFAULT 'SLZ',
ADD COLUMN     "dealServicesEnabled" "DealService"[] DEFAULT ARRAY[]::"DealService"[],
ADD COLUMN     "payoutTargetMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "rateLockMinutes" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "service" "DealService" NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'NEW',
    "customerName" TEXT NOT NULL,
    "customerWhatsapp" TEXT NOT NULL,
    "customerEmail" TEXT,
    "details" JSONB NOT NULL,
    "detailsVersion" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "quotedRate" DECIMAL(18,4),
    "quotedNaira" DECIMAL(24,8),
    "quotedBoardId" TEXT,
    "quotedAt" TIMESTAMP(3),
    "agreedRate" DECIMAL(18,4),
    "feeNaira" DECIMAL(24,8),
    "agreedNaira" DECIMAL(24,8),
    "agreedAt" TIMESTAMP(3),
    "agreedById" TEXT,
    "paymentAccountId" TEXT,
    "payoutBank" TEXT,
    "payoutAccountNumber" TEXT,
    "payoutAccountName" TEXT,
    "payoutReference" TEXT,
    "paidFromAccountId" TEXT,
    "ownerMembershipId" TEXT,
    "cancelReason" TEXT,
    "trackingTokenHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealEvent" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" "DealEventType" NOT NULL,
    "fromStatus" "DealStatus",
    "toStatus" "DealStatus",
    "message" TEXT NOT NULL,
    "data" JSONB,
    "actorType" "DealActor" NOT NULL,
    "actorMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealFile" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "kind" "DealFileKind" NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "uploadedBy" "DealActor" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "services" "DealService"[] DEFAULT ARRAY[]::"DealService"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_organizationId_status_statusChangedAt_idx" ON "Deal"("organizationId", "status", "statusChangedAt");

-- CreateIndex
CREATE INDEX "Deal_organizationId_createdAt_idx" ON "Deal"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Deal_organizationId_customerWhatsapp_idx" ON "Deal"("organizationId", "customerWhatsapp");

-- CreateIndex
CREATE INDEX "Deal_ipHash_createdAt_idx" ON "Deal"("ipHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_organizationId_ref_key" ON "Deal"("organizationId", "ref");

-- CreateIndex
CREATE INDEX "DealEvent_dealId_createdAt_idx" ON "DealEvent"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "DealFile_dealId_createdAt_idx" ON "DealFile"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAccount_organizationId_active_sortOrder_idx" ON "PaymentAccount"("organizationId", "active", "sortOrder");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_dealDefaultOwnerId_fkey" FOREIGN KEY ("dealDefaultOwnerId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_agreedById_fkey" FOREIGN KEY ("agreedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_paidFromAccountId_fkey" FOREIGN KEY ("paidFromAccountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerMembershipId_fkey" FOREIGN KEY ("ownerMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_actorMembershipId_fkey" FOREIGN KEY ("actorMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFile" ADD CONSTRAINT "DealFile_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Hand-written: Deal desk guards (Invariants 10 and 15) ─────────────

-- Amounts are positive; agreed values are never negative.
ALTER TABLE "Deal" ADD CONSTRAINT "deal_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Deal" ADD CONSTRAINT "deal_agreed_non_negative" CHECK (
  ("agreedRate" IS NULL OR "agreedRate" > 0)
  AND ("feeNaira" IS NULL OR "feeNaira" >= 0)
  AND ("agreedNaira" IS NULL OR "agreedNaira" >= 0)
);

-- The website estimate never changes after the deal is created.
CREATE FUNCTION "deal_quote_immutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."quotedRate" IS DISTINCT FROM OLD."quotedRate"
     OR NEW."quotedNaira" IS DISTINCT FROM OLD."quotedNaira"
     OR NEW."quotedBoardId" IS DISTINCT FROM OLD."quotedBoardId"
     OR NEW."quotedAt" IS DISTINCT FROM OLD."quotedAt" THEN
    RAISE EXCEPTION 'deal_quote_immutable: the quoted rate of a deal never changes'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "deal_quote_immutable"
  BEFORE UPDATE ON "Deal"
  FOR EACH ROW EXECUTE FUNCTION "deal_quote_immutable"();

-- The activity log is append-only: events are never edited.
CREATE FUNCTION "deal_event_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'deal_event_append_only: deal events are never updated'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "deal_event_append_only"
  BEFORE UPDATE ON "DealEvent"
  FOR EACH ROW EXECUTE FUNCTION "deal_event_append_only"();
