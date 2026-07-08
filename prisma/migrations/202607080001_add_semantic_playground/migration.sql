CREATE TABLE "CampaignSemanticPlaygroundRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "fetchedFrom" TIMESTAMP(3) NOT NULL,
    "fetchedTo" TIMESTAMP(3) NOT NULL,
    "querySnapshot" JSONB NOT NULL,
    "statsJson" JSONB,
    "error" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSemanticPlaygroundRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignSemanticPlaygroundQuery" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "category" TEXT,
    "dimensions" INTEGER NOT NULL DEFAULT 1536,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSemanticPlaygroundQuery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignSemanticPlaygroundResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "redditItemId" TEXT NOT NULL,
    "bestScore" DOUBLE PRECISION NOT NULL,
    "bestQueryId" TEXT,
    "bestQueryText" TEXT,
    "classificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "label" "LeadLabel",
    "intentType" "LeadIntentType",
    "buyerStage" "BuyerStage",
    "category" TEXT,
    "summary" TEXT,
    "painPoints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "disqualifier" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "error" TEXT,
    "classifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSemanticPlaygroundResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignSemanticPlaygroundResult_runId_redditItemId_key"
ON "CampaignSemanticPlaygroundResult"("runId", "redditItemId");

CREATE INDEX "CampaignSemanticPlaygroundRun_campaignId_createdAt_idx"
ON "CampaignSemanticPlaygroundRun"("campaignId", "createdAt" DESC);

CREATE INDEX "CampaignSemanticPlaygroundRun_userId_createdAt_idx"
ON "CampaignSemanticPlaygroundRun"("userId", "createdAt" DESC);

CREATE INDEX "CampaignSemanticPlaygroundRun_status_updatedAt_idx"
ON "CampaignSemanticPlaygroundRun"("status", "updatedAt" DESC);

CREATE INDEX "CampaignSemanticPlaygroundQuery_runId_idx"
ON "CampaignSemanticPlaygroundQuery"("runId");

CREATE INDEX "CampaignSemanticPlaygroundResult_runId_bestScore_idx"
ON "CampaignSemanticPlaygroundResult"("runId", "bestScore" DESC);

CREATE INDEX "CampaignSemanticPlaygroundResult_redditItemId_idx"
ON "CampaignSemanticPlaygroundResult"("redditItemId");

CREATE INDEX "CampaignSemanticPlaygroundResult_classificationStatus_updatedAt_idx"
ON "CampaignSemanticPlaygroundResult"("classificationStatus", "updatedAt" DESC);

ALTER TABLE "CampaignSemanticPlaygroundRun"
ADD CONSTRAINT "CampaignSemanticPlaygroundRun_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignSemanticPlaygroundRun"
ADD CONSTRAINT "CampaignSemanticPlaygroundRun_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignSemanticPlaygroundQuery"
ADD CONSTRAINT "CampaignSemanticPlaygroundQuery_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "CampaignSemanticPlaygroundRun"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignSemanticPlaygroundResult"
ADD CONSTRAINT "CampaignSemanticPlaygroundResult_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "CampaignSemanticPlaygroundRun"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignSemanticPlaygroundResult"
ADD CONSTRAINT "CampaignSemanticPlaygroundResult_redditItemId_fkey"
FOREIGN KEY ("redditItemId") REFERENCES "RedditItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
