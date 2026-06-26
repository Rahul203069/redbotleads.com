CREATE TYPE "CampaignDailySemanticScanStatus" AS ENUM ('MATCHED', 'NO_MATCH');

CREATE TABLE "CampaignDailySemanticScan" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "redditItemId" TEXT NOT NULL,
  "status" "CampaignDailySemanticScanStatus" NOT NULL,
  "bestScore" DOUBLE PRECISION,
  "bestQueryId" TEXT,
  "bestQueryText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CampaignDailySemanticScan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignDailySemanticScan_campaignId_redditItemId_key"
ON "CampaignDailySemanticScan"("campaignId", "redditItemId");

CREATE INDEX "CampaignDailySemanticScan_campaignId_status_updatedAt_idx"
ON "CampaignDailySemanticScan"("campaignId", "status", "updatedAt" DESC);

CREATE INDEX "CampaignDailySemanticScan_redditItemId_idx"
ON "CampaignDailySemanticScan"("redditItemId");

ALTER TABLE "CampaignDailySemanticScan"
ADD CONSTRAINT "CampaignDailySemanticScan_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignDailySemanticScan"
ADD CONSTRAINT "CampaignDailySemanticScan_redditItemId_fkey"
FOREIGN KEY ("redditItemId") REFERENCES "RedditItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
