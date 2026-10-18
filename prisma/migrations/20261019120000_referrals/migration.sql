-- Phase 13c: referral programme (Stage A: staff codes and the rewards
-- ledger). Additive only: new tables, and new columns that are nullable or
-- defaulted, so it's safe on the live database. The programme starts off.

-- CreateEnum
CREATE TYPE "ReferralKind" AS ENUM ('STAFF', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'VOID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DealEventType" ADD VALUE 'REFERRAL';
ALTER TYPE "DealEventType" ADD VALUE 'PROFIT_RECORDED';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "profitNaira" DECIMAL(24,8),
ADD COLUMN     "referralCodeId" TEXT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "referralEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referralEndsAt" TIMESTAMP(3),
ADD COLUMN     "referralHoldDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "referralMonthlyCapNaira" DECIMAL(24,8),
ADD COLUMN     "referralNewCustomersOnly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "referralRewardPct" DECIMAL(5,2) NOT NULL DEFAULT 15,
ADD COLUMN     "referralServices" "DealService"[] DEFAULT ARRAY['SCHOOL_FEES', 'INTL_PAYMENT', 'POF', 'FOREX_SELL', 'FOREX_BUY', 'CRYPTO_SELL']::"DealService"[],
ADD COLUMN     "referralStartsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "ReferralKind" NOT NULL,
    "membershipId" TEXT,
    "customerWhatsapp" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "referrerKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "dealRef" TEXT NOT NULL,
    "service" "DealService" NOT NULL,
    "pct" DECIMAL(5,2) NOT NULL,
    "profitNaira" DECIMAL(24,8) NOT NULL,
    "amountNaira" DECIMAL(24,8) NOT NULL,
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
    "holdUntil" TIMESTAMP(3) NOT NULL,
    "notBefore" TIMESTAMP(3),
    "flag" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "bankReference" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferralCode_organizationId_kind_idx" ON "ReferralCode"("organizationId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_organizationId_code_key" ON "ReferralCode"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_dealId_key" ON "ReferralReward"("dealId");

-- CreateIndex
CREATE INDEX "ReferralReward_organizationId_status_idx" ON "ReferralReward"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ReferralReward_organizationId_referrerKey_approvedAt_idx" ON "ReferralReward"("organizationId", "referrerKey", "approvedAt");

-- CreateIndex
CREATE INDEX "ReferralReward_codeId_idx" ON "ReferralReward"("codeId");

-- CreateIndex
CREATE INDEX "Deal_referralCodeId_idx" ON "Deal"("referralCodeId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ── Guards ──────────────────────────────────────────────────────────────

ALTER TABLE "Organization" ADD CONSTRAINT "org_referral_settings" CHECK (
  "referralRewardPct" >= 0 AND "referralRewardPct" <= 100
  AND "referralHoldDays" >= 0 AND "referralHoldDays" <= 365
  AND ("referralMonthlyCapNaira" IS NULL OR "referralMonthlyCapNaira" >= 0)
  AND ("referralStartsAt" IS NULL OR "referralEndsAt" IS NULL
       OR "referralEndsAt" > "referralStartsAt")
);

ALTER TABLE "Deal" ADD CONSTRAINT "deal_profit_naira"
  CHECK ("profitNaira" IS NULL OR "profitNaira" >= 0);

-- A code is A–Z 0–9, 4–12 characters, and belongs to a team member (STAFF)
-- or a customer's number (CUSTOMER).
ALTER TABLE "ReferralCode" ADD CONSTRAINT "referral_code_shape" CHECK (
  "code" ~ '^[A-Z0-9]{4,12}$'
  AND (("kind" = 'STAFF' AND "membershipId" IS NOT NULL AND "customerWhatsapp" IS NULL)
    OR ("kind" = 'CUSTOMER' AND "customerWhatsapp" IS NOT NULL AND "membershipId" IS NULL))
);

ALTER TABLE "ReferralReward" ADD CONSTRAINT "referral_reward_values" CHECK (
  "pct" >= 0 AND "pct" <= 100
  AND "profitNaira" >= 0
  AND "amountNaira" >= 0
  AND "amountNaira" = trunc("amountNaira")
  AND ("status" <> 'APPROVED' OR "approvedAt" IS NOT NULL)
  AND ("status" <> 'PAID' OR ("paidAt" IS NOT NULL AND "bankReference" IS NOT NULL))
  AND ("status" <> 'VOID' OR ("voidedAt" IS NOT NULL AND "voidReason" IS NOT NULL))
);

-- The reward's snapshot never changes, and its status only moves forward:
-- PENDING → APPROVED → PAID, or PENDING / APPROVED → VOID. PAID and VOID
-- are final.
CREATE FUNCTION "referral_reward_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."dealId" IS DISTINCT FROM OLD."dealId"
     OR NEW."codeId" IS DISTINCT FROM OLD."codeId"
     OR NEW."referrerKey" IS DISTINCT FROM OLD."referrerKey"
     OR NEW."code" IS DISTINCT FROM OLD."code"
     OR NEW."dealRef" IS DISTINCT FROM OLD."dealRef"
     OR NEW."service" IS DISTINCT FROM OLD."service"
     OR NEW."pct" IS DISTINCT FROM OLD."pct"
     OR NEW."profitNaira" IS DISTINCT FROM OLD."profitNaira"
     OR NEW."amountNaira" IS DISTINCT FROM OLD."amountNaira"
     OR NEW."holdUntil" IS DISTINCT FROM OLD."holdUntil" THEN
    RAISE EXCEPTION 'referral_reward_guard: a reward''s snapshot never changes'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
       (OLD."status" = 'PENDING' AND NEW."status" IN ('APPROVED', 'VOID'))
    OR (OLD."status" = 'APPROVED' AND NEW."status" IN ('PAID', 'VOID'))
  ) THEN
    RAISE EXCEPTION 'referral_reward_guard: a reward can''t move from % to %', OLD."status", NEW."status"
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."status" IN ('PAID', 'VOID') AND ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
    RAISE EXCEPTION 'referral_reward_guard: a paid or void reward never changes'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "referral_reward_guard"
  BEFORE UPDATE ON "ReferralReward"
  FOR EACH ROW EXECUTE FUNCTION "referral_reward_guard"();

-- A deal's referral code can change only while the deal is NEW or
-- AWAITING_DEPOSIT (before the rate is agreed or a deposit is seen); our
-- profit is entered once.
CREATE FUNCTION "deal_referral_locked"() RETURNS trigger AS $$
BEGIN
  IF NEW."referralCodeId" IS DISTINCT FROM OLD."referralCodeId"
     AND OLD."status" NOT IN ('NEW', 'AWAITING_DEPOSIT') THEN
    RAISE EXCEPTION 'deal_referral_locked: the referral code is locked once the deal is agreed'
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."profitNaira" IS NOT NULL
     AND NEW."profitNaira" IS DISTINCT FROM OLD."profitNaira" THEN
    RAISE EXCEPTION 'deal_referral_locked: our profit on a deal is entered once'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "deal_referral_locked"
  BEFORE UPDATE ON "Deal"
  FOR EACH ROW EXECUTE FUNCTION "deal_referral_locked"();
