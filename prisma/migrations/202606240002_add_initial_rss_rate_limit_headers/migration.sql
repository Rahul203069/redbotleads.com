ALTER TABLE "CampaignInitialRssPollEvent"
  ADD COLUMN "ratelimitUsed" TEXT,
  ADD COLUMN "ratelimitRemaining" TEXT,
  ADD COLUMN "ratelimitReset" TEXT,
  ADD COLUMN "retryAfter" TEXT;
