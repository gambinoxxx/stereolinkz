-- Referrals, customer side: campaigns, customer codes (one active per
-- number, unlocked by a completed deal, with a private page token stored
-- as a hash), the campaign on a deal and a reward, and two event types.
-- Additive only: a new table, nullable columns, new enum values, and new
-- guards. The old Organization referral fields stay, unused.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DealEventType" ADD VALUE 'REFERRAL_REMOVED';
ALTER TYPE "DealEventType" ADD VALUE 'REWARD_CHANGED';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "referralCampaignId" TEXT;

-- AlterTable
ALTER TABLE "ReferralCode" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "firstDealId" TEXT,
ADD COLUMN     "pageTokenAt" TIMESTAMP(3),
ADD COLUMN     "pageTokenHash" TEXT;

-- AlterTable
ALTER TABLE "ReferralReward" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "rewardBps" INTEGER;

-- CreateTable
CREATE TABLE "ReferralCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "rewardBps" INTEGER NOT NULL DEFAULT 1500,
    "includeCrypto" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferralCampaign_organizationId_active_idx" ON "ReferralCampaign"("organizationId", "active");

-- CreateIndex
CREATE INDEX "Deal_referralCampaignId_idx" ON "Deal"("referralCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_pageTokenHash_key" ON "ReferralCode"("pageTokenHash");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_referralCampaignId_fkey" FOREIGN KEY ("referralCampaignId") REFERENCES "ReferralCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_firstDealId_fkey" FOREIGN KEY ("firstDealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCampaign" ADD CONSTRAINT "ReferralCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCampaign" ADD CONSTRAINT "ReferralCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Guards ──────────────────────────────────────────────────────────────

-- One active campaign per organization.
CREATE UNIQUE INDEX "referral_campaign_one_active"
  ON "ReferralCampaign" ("organizationId") WHERE "active";

ALTER TABLE "ReferralCampaign" ADD CONSTRAINT "referral_campaign_values" CHECK (
  "rewardBps" >= 0 AND "rewardBps" <= 10000
  AND "endsAt" > "startsAt"
  AND length(trim("name")) > 0
);

-- One active customer code per WhatsApp number.
CREATE UNIQUE INDEX "referral_code_one_active_customer"
  ON "ReferralCode" ("organizationId", "customerWhatsapp")
  WHERE "kind" = 'CUSTOMER' AND "active";

ALTER TABLE "ReferralReward" ADD CONSTRAINT "referral_reward_bps"
  CHECK ("rewardBps" IS NULL OR ("rewardBps" >= 0 AND "rewardBps" <= 10000));

-- A deal's referral: the code (and its campaign) can be ADDED only while
-- the deal is NEW, and REMOVED at any time (with a reason, by the team);
-- never swapped for another. Our profit is still entered once.
CREATE OR REPLACE FUNCTION "deal_referral_locked"() RETURNS trigger AS $$
BEGIN
  IF NEW."referralCodeId" IS DISTINCT FROM OLD."referralCodeId" THEN
    IF OLD."referralCodeId" IS NOT NULL AND NEW."referralCodeId" IS NOT NULL THEN
      RAISE EXCEPTION 'deal_referral_locked: a deal''s referral code is never swapped'
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."referralCodeId" IS NULL AND OLD."status" <> 'NEW' THEN
      RAISE EXCEPTION 'deal_referral_locked: a referral code can be added only while the deal is NEW'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW."referralCampaignId" IS DISTINCT FROM OLD."referralCampaignId" THEN
    IF OLD."referralCampaignId" IS NOT NULL AND NEW."referralCampaignId" IS NOT NULL THEN
      RAISE EXCEPTION 'deal_referral_locked: a deal''s referral campaign is never swapped'
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."referralCampaignId" IS NULL AND OLD."status" <> 'NEW' THEN
      RAISE EXCEPTION 'deal_referral_locked: a referral campaign can be added only while the deal is NEW'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF OLD."profitNaira" IS NOT NULL
     AND NEW."profitNaira" IS DISTINCT FROM OLD."profitNaira" THEN
    RAISE EXCEPTION 'deal_referral_locked: our profit on a deal is entered once'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
