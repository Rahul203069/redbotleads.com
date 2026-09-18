CREATE TYPE "OutreachRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'LIMIT_REACHED', 'COMPLETED', 'STOPPED', 'FAILED');
CREATE TYPE "OutreachRunPostStatus" AS ENUM ('QUEUED', 'SCANNING', 'GENERATING', 'READY', 'COMPLETED', 'SKIPPED', 'FAILED');
CREATE TYPE "OutreachMessageStage" AS ENUM ('INITIAL', 'FOLLOW_UP');
CREATE TYPE "OutreachAttemptStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'SENT', 'SKIPPED', 'FAILED');

CREATE TABLE "CampaignOutreachSettings" (
    "campaignId" TEXT NOT NULL,
    "firstTouchInstructions" TEXT NOT NULL DEFAULT '',
    "firstTouchExamples" TEXT NOT NULL DEFAULT '',
    "followUpInstructions" TEXT NOT NULL DEFAULT '',
    "followUpExamples" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampaignOutreachSettings_pkey" PRIMARY KEY ("campaignId")
);

CREATE TABLE "OutreachRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "redditAccountId" TEXT NOT NULL,
    "status" "OutreachRunStatus" NOT NULL DEFAULT 'QUEUED',
    "filterJson" JSONB NOT NULL,
    "publicLeadsUrl" TEXT NOT NULL,
    "extensionVersion" TEXT,
    "queuedPosts" INTEGER NOT NULL DEFAULT 0,
    "analyzedPosts" INTEGER NOT NULL DEFAULT 0,
    "draftedMessages" INTEGER NOT NULL DEFAULT 0,
    "sentMessages" INTEGER NOT NULL DEFAULT 0,
    "skippedMessages" INTEGER NOT NULL DEFAULT 0,
    "failedMessages" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutreachRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutreachRunPost" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "redditItemId" TEXT NOT NULL,
    "leadId" TEXT,
    "status" "OutreachRunPostStatus" NOT NULL DEFAULT 'QUEUED',
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "selectedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutreachRunPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutreachContact" (
    "id" TEXT NOT NULL,
    "redditAccountId" TEXT NOT NULL,
    "normalizedUsername" TEXT NOT NULL,
    "displayUsername" TEXT NOT NULL,
    "firstSentAt" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutreachContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutreachAttempt" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "runPostId" TEXT,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sourceRedditItemId" TEXT NOT NULL,
    "sourceCommentId" TEXT,
    "sourceCommentUrl" TEXT,
    "stage" "OutreachMessageStage" NOT NULL,
    "status" "OutreachAttemptStatus" NOT NULL DEFAULT 'DRAFT',
    "qualificationReason" TEXT,
    "message" TEXT NOT NULL,
    "publicLeadsUrl" TEXT NOT NULL,
    "error" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutreachAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutreachRun_redditAccountId_status_updatedAt_idx" ON "OutreachRun"("redditAccountId", "status", "updatedAt" DESC);
CREATE INDEX "OutreachRun_campaignId_createdAt_idx" ON "OutreachRun"("campaignId", "createdAt" DESC);
CREATE INDEX "OutreachRun_userId_createdAt_idx" ON "OutreachRun"("userId", "createdAt" DESC);
CREATE UNIQUE INDEX "OutreachRunPost_runId_redditItemId_key" ON "OutreachRunPost"("runId", "redditItemId");
CREATE INDEX "OutreachRunPost_runId_status_createdAt_idx" ON "OutreachRunPost"("runId", "status", "createdAt");
CREATE UNIQUE INDEX "OutreachContact_redditAccountId_normalizedUsername_key" ON "OutreachContact"("redditAccountId", "normalizedUsername");
CREATE INDEX "OutreachContact_redditAccountId_lastSentAt_idx" ON "OutreachContact"("redditAccountId", "lastSentAt" DESC);
CREATE UNIQUE INDEX "OutreachAttempt_contactId_stage_key" ON "OutreachAttempt"("contactId", "stage");
CREATE INDEX "OutreachAttempt_runId_status_createdAt_idx" ON "OutreachAttempt"("runId", "status", "createdAt");
CREATE INDEX "OutreachAttempt_campaignId_createdAt_idx" ON "OutreachAttempt"("campaignId", "createdAt" DESC);
CREATE INDEX "OutreachAttempt_status_sentAt_idx" ON "OutreachAttempt"("status", "sentAt" DESC);

ALTER TABLE "CampaignOutreachSettings" ADD CONSTRAINT "CampaignOutreachSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachRun" ADD CONSTRAINT "OutreachRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachRun" ADD CONSTRAINT "OutreachRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachRun" ADD CONSTRAINT "OutreachRun_redditAccountId_fkey" FOREIGN KEY ("redditAccountId") REFERENCES "RedditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachRunPost" ADD CONSTRAINT "OutreachRunPost_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OutreachRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachRunPost" ADD CONSTRAINT "OutreachRunPost_redditItemId_fkey" FOREIGN KEY ("redditItemId") REFERENCES "RedditItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachContact" ADD CONSTRAINT "OutreachContact_redditAccountId_fkey" FOREIGN KEY ("redditAccountId") REFERENCES "RedditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OutreachRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_runPostId_fkey" FOREIGN KEY ("runPostId") REFERENCES "OutreachRunPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "OutreachContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_sourceRedditItemId_fkey" FOREIGN KEY ("sourceRedditItemId") REFERENCES "RedditItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
