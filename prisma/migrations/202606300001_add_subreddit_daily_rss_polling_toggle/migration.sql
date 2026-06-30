ALTER TABLE "Subreddit"
ADD COLUMN "dailyRssPollingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dailyRssPollingDisabledAt" TIMESTAMP(3),
ADD COLUMN "dailyRssPollingDisabledBy" TEXT;
