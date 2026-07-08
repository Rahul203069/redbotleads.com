CREATE TABLE "CampaignClientAccess" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "userId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignClientAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignClientAccess_campaignId_normalizedEmail_key"
ON "CampaignClientAccess"("campaignId", "normalizedEmail");

CREATE INDEX "CampaignClientAccess_normalizedEmail_idx"
ON "CampaignClientAccess"("normalizedEmail");

CREATE INDEX "CampaignClientAccess_userId_idx"
ON "CampaignClientAccess"("userId");

CREATE INDEX "CampaignClientAccess_createdByUserId_createdAt_idx"
ON "CampaignClientAccess"("createdByUserId", "createdAt" DESC);

ALTER TABLE "CampaignClientAccess"
ADD CONSTRAINT "CampaignClientAccess_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignClientAccess"
ADD CONSTRAINT "CampaignClientAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignClientAccess"
ADD CONSTRAINT "CampaignClientAccess_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
