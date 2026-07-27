-- Phase 2.9 — Marketing & Campaigns
-- Additive: two new tables (Campaign, CampaignEvent) + two enums, plus a single
-- nullable FK column (Order.campaignId) for attribution. No existing column is
-- changed; the public checkout never sets campaignId (stays NULL), and deleting a
-- campaign nulls the link (SET NULL) rather than touching order history.
--
-- Rollback (reversible) — run in this order to fully undo:
--   ALTER TABLE "Order" DROP CONSTRAINT "Order_campaignId_fkey";
--   DROP INDEX "Order_campaignId_idx";
--   ALTER TABLE "Order" DROP COLUMN "campaignId";
--   ALTER TABLE "CampaignEvent" DROP CONSTRAINT "CampaignEvent_campaignId_fkey";
--   DROP TABLE "CampaignEvent";
--   DROP TABLE "Campaign";
--   DROP TYPE "CampaignPlatform";
--   DROP TYPE "CampaignStatus";

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'GOOGLE', 'SNAPCHAT', 'MANUAL');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "campaignId" TEXT;

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "CampaignPlatform" NOT NULL DEFAULT 'MANUAL',
    "objective" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "budget" INTEGER NOT NULL DEFAULT 0,
    "spent" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_platform_idx" ON "Campaign"("platform");

-- CreateIndex
CREATE INDEX "CampaignEvent_campaignId_idx" ON "CampaignEvent"("campaignId");

-- CreateIndex
CREATE INDEX "Order_campaignId_idx" ON "Order"("campaignId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
