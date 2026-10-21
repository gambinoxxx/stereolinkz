-- WhatsApp bot: contacts (bot pause and state) and message ids for
-- idempotency. Additive only; no message bodies are stored.

-- CreateEnum
CREATE TYPE "WhatsAppDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "WhatsAppContact" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInboundAt" TIMESTAMP(3),
    "botPausedUntil" TIMESTAMP(3),
    "state" TEXT,
    "stateAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppEvent" (
    "id" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "direction" "WhatsAppDirection" NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppContact_waId_key" ON "WhatsAppContact"("waId");

-- CreateIndex
CREATE INDEX "WhatsAppContact_botPausedUntil_idx" ON "WhatsAppContact"("botPausedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppEvent_waMessageId_key" ON "WhatsAppEvent"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppEvent_waId_createdAt_idx" ON "WhatsAppEvent"("waId", "createdAt");

