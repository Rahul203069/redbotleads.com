CREATE TYPE "CampaignInitialRssPollStatus" AS ENUM (
  'FETCHING',
  'SUCCESS',
  'RATE_LIMIT_RETRYING',
  'RATE_LIMITED',
  'NOT_FOUND',
  'HTTP_ERROR',
  'NETWORK_ERROR'
);

CREATE TABLE "CampaignInitialRssPollEvent" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "campaignRunId" TEXT NOT NULL,
  "subreddit" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "attempt" INTEGER NOT NULL,
  "jobId" TEXT,
  "status" "CampaignInitialRssPollStatus" NOT NULL DEFAULT 'FETCHING',
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "fetchStartedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "waitMs" INTEGER,
  "nextRequestDelayMs" INTEGER,
  "nextRequestAt" TIMESTAMP(3),
  "httpStatus" INTEGER,
  "statusText" TEXT,
  "errorMessage" TEXT,
  "retryAfterMs" INTEGER,
  "retryWaitMs" INTEGER,
  "retryUntil" TIMESTAMP(3),
  "fetchedPosts" INTEGER,
  "matchedItems" INTEGER,
  "createdLeads" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CampaignInitialRssPollEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignInitialRssPollEvent_campaignId_requestedAt_idx"
  ON "CampaignInitialRssPollEvent"("campaignId", "requestedAt" DESC);

CREATE INDEX "CampaignInitialRssPollEvent_campaignRunId_sequence_attempt_idx"
  ON "CampaignInitialRssPollEvent"("campaignRunId", "sequence", "attempt");

CREATE INDEX "CampaignInitialRssPollEvent_subreddit_requestedAt_idx"
  ON "CampaignInitialRssPollEvent"("subreddit", "requestedAt" DESC);

CREATE INDEX "CampaignInitialRssPollEvent_status_requestedAt_idx"
  ON "CampaignInitialRssPollEvent"("status", "requestedAt" DESC);

ALTER TABLE "CampaignInitialRssPollEvent"
  ADD CONSTRAINT "CampaignInitialRssPollEvent_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignInitialRssPollEvent"
  ADD CONSTRAINT "CampaignInitialRssPollEvent_campaignRunId_fkey"
  FOREIGN KEY ("campaignRunId") REFERENCES "CampaignRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
