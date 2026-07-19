CREATE TABLE "CampaignPublicVisitor" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "campaignViews" INTEGER NOT NULL DEFAULT 0,
    "leadsViews" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignPublicVisitor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignPublicVisitor_campaignId_visitorHash_key"
ON "CampaignPublicVisitor"("campaignId", "visitorHash");

CREATE INDEX "CampaignPublicVisitor_campaignId_updatedAt_idx"
ON "CampaignPublicVisitor"("campaignId", "updatedAt" DESC);

ALTER TABLE "CampaignPublicVisitor"
ADD CONSTRAINT "CampaignPublicVisitor_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
