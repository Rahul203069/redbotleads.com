CREATE TABLE "CampaignLeadViewState" (
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "lastViewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignLeadViewState_pkey" PRIMARY KEY ("userId","campaignId")
);

CREATE INDEX "CampaignLeadViewState_campaignId_lastViewedAt_idx"
ON "CampaignLeadViewState"("campaignId", "lastViewedAt" DESC);

ALTER TABLE "CampaignLeadViewState"
ADD CONSTRAINT "CampaignLeadViewState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignLeadViewState"
ADD CONSTRAINT "CampaignLeadViewState_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
