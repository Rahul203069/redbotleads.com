CREATE TABLE "CronRun" (
  "id" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "message" TEXT,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "statsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CampaignRun"
ADD COLUMN "cronRunId" TEXT;

ALTER TABLE "CampaignDailySemanticScan"
ADD COLUMN "campaignRunId" TEXT;

ALTER TABLE "Notification"
ADD COLUMN "campaignRunId" TEXT;

CREATE INDEX "CronRun_path_startedAt_idx"
ON "CronRun"("path", "startedAt" DESC);

CREATE INDEX "CronRun_status_startedAt_idx"
ON "CronRun"("status", "startedAt" DESC);

CREATE INDEX "CampaignRun_cronRunId_idx"
ON "CampaignRun"("cronRunId");

CREATE INDEX "CampaignDailySemanticScan_campaignRunId_idx"
ON "CampaignDailySemanticScan"("campaignRunId");

CREATE INDEX "Notification_campaignRunId_createdAt_idx"
ON "Notification"("campaignRunId", "createdAt" DESC);

ALTER TABLE "CampaignRun"
ADD CONSTRAINT "CampaignRun_cronRunId_fkey"
FOREIGN KEY ("cronRunId") REFERENCES "CronRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignDailySemanticScan"
ADD CONSTRAINT "CampaignDailySemanticScan_campaignRunId_fkey"
FOREIGN KEY ("campaignRunId") REFERENCES "CampaignRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_campaignRunId_fkey"
FOREIGN KEY ("campaignRunId") REFERENCES "CampaignRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
