ALTER TABLE "Campaign"
ADD COLUMN "rssPollingEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Campaign"
SET "rssPollingEnabled" = "isActive";
