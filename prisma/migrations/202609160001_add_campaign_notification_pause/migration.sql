ALTER TYPE "NotifyStatus" ADD VALUE 'SKIPPED';

ALTER TABLE "Campaign"
ADD COLUMN "notificationsPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notificationEpoch" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Notification"
ADD COLUMN "campaignNotificationEpoch" INTEGER NOT NULL DEFAULT 0;
