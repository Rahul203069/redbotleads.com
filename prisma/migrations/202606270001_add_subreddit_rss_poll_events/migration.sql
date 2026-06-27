CREATE TYPE "SubredditRssPollSource" AS ENUM (
  'SUBREDDIT_DAILY_INGEST',
  'RSS_POLL'
);

CREATE TYPE "SubredditRssPollStatus" AS ENUM (
  'FETCHING',
  'SUCCESS',
  'RATE_LIMIT_RETRYING',
  'RATE_LIMITED',
  'NOT_FOUND',
  'HTTP_ERROR',
  'NETWORK_ERROR',
  'BACKOFF_SKIPPED'
);

CREATE TABLE "SubredditRssPollEvent" (
  "id" TEXT NOT NULL,
  "subreddit" TEXT NOT NULL,
  "source" "SubredditRssPollSource" NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "jobId" TEXT,
  "status" "SubredditRssPollStatus" NOT NULL DEFAULT 'FETCHING',
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
  "ratelimitUsed" TEXT,
  "ratelimitRemaining" TEXT,
  "ratelimitReset" TEXT,
  "retryAfter" TEXT,
  "retryAfterMs" INTEGER,
  "retryWaitMs" INTEGER,
  "retryUntil" TIMESTAMP(3),
  "fetchedPosts" INTEGER,
  "existingPosts" INTEGER,
  "createdPosts" INTEGER,
  "queuedEmbeddings" INTEGER,
  "backoffUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SubredditRssPollEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubredditRssPollEvent_requestedAt_idx"
  ON "SubredditRssPollEvent"("requestedAt" DESC);

CREATE INDEX "SubredditRssPollEvent_subreddit_requestedAt_idx"
  ON "SubredditRssPollEvent"("subreddit", "requestedAt" DESC);

CREATE INDEX "SubredditRssPollEvent_source_requestedAt_idx"
  ON "SubredditRssPollEvent"("source", "requestedAt" DESC);

CREATE INDEX "SubredditRssPollEvent_status_requestedAt_idx"
  ON "SubredditRssPollEvent"("status", "requestedAt" DESC);
