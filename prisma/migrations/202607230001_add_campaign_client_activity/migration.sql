CREATE TYPE "CampaignClientActivityEventType" AS ENUM (
    'CAMPAIGN_DASHBOARD_VIEW',
    'DAILY_LEADS_VIEW',
    'LEAD_EXPANDED',
    'REDDIT_LINK_CLICKED'
);

CREATE TABLE "CampaignClientActivityEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clientAccessId" TEXT,
    "leadId" TEXT,
    "eventType" "CampaignClientActivityEventType" NOT NULL,
    "availableLeadCount" INTEGER,
    "newLeadCountSinceLastVisit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignClientActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignClientActivityEvent_eventKey_key"
ON "CampaignClientActivityEvent"("eventKey");

CREATE INDEX "CampaignClientActivityEvent_userId_createdAt_idx"
ON "CampaignClientActivityEvent"("userId", "createdAt" DESC);

CREATE INDEX "CampaignClientActivityEvent_campaignId_userId_createdAt_idx"
ON "CampaignClientActivityEvent"("campaignId", "userId", "createdAt" DESC);

CREATE INDEX "CampaignClientActivityEvent_clientAccessId_createdAt_idx"
ON "CampaignClientActivityEvent"("clientAccessId", "createdAt" DESC);

CREATE INDEX "CampaignClientActivityEvent_eventType_createdAt_idx"
ON "CampaignClientActivityEvent"("eventType", "createdAt" DESC);

CREATE INDEX "CampaignClientActivityEvent_leadId_idx"
ON "CampaignClientActivityEvent"("leadId");

ALTER TABLE "CampaignClientActivityEvent"
ADD CONSTRAINT "CampaignClientActivityEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignClientActivityEvent"
ADD CONSTRAINT "CampaignClientActivityEvent_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignClientActivityEvent"
ADD CONSTRAINT "CampaignClientActivityEvent_clientAccessId_fkey"
FOREIGN KEY ("clientAccessId") REFERENCES "CampaignClientAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignClientActivityEvent"
ADD CONSTRAINT "CampaignClientActivityEvent_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "CampaignClientAccess" AS access
SET
    "userId" = matched_user."id",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "User" AS matched_user
WHERE matched_user."email" IS NOT NULL
  AND LOWER(BTRIM(matched_user."email")) = access."normalizedEmail"
  AND access."userId" IS DISTINCT FROM matched_user."id";
