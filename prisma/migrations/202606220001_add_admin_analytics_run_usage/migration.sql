CREATE TABLE "CampaignRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "message" TEXT,
  "error" TEXT,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "statsJson" JSONB,
  "totalCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CampaignRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiUsageEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "campaignId" TEXT,
  "campaignRunId" TEXT,
  "operation" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'openai',
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "totalTokens" INTEGER,
  "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignRun_userId_createdAt_idx" ON "CampaignRun"("userId", "createdAt" DESC);
CREATE INDEX "CampaignRun_campaignId_createdAt_idx" ON "CampaignRun"("campaignId", "createdAt" DESC);
CREATE INDEX "CampaignRun_status_updatedAt_idx" ON "CampaignRun"("status", "updatedAt" DESC);

CREATE INDEX "AiUsageEvent_userId_createdAt_idx" ON "AiUsageEvent"("userId", "createdAt" DESC);
CREATE INDEX "AiUsageEvent_campaignId_createdAt_idx" ON "AiUsageEvent"("campaignId", "createdAt" DESC);
CREATE INDEX "AiUsageEvent_campaignRunId_createdAt_idx" ON "AiUsageEvent"("campaignRunId", "createdAt" DESC);
CREATE INDEX "AiUsageEvent_operation_createdAt_idx" ON "AiUsageEvent"("operation", "createdAt" DESC);

ALTER TABLE "CampaignRun"
  ADD CONSTRAINT "CampaignRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignRun"
  ADD CONSTRAINT "CampaignRun_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiUsageEvent"
  ADD CONSTRAINT "AiUsageEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiUsageEvent"
  ADD CONSTRAINT "AiUsageEvent_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiUsageEvent"
  ADD CONSTRAINT "AiUsageEvent_campaignRunId_fkey"
  FOREIGN KEY ("campaignRunId") REFERENCES "CampaignRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
