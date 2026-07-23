CREATE TYPE "NotificationRecipientRole" AS ENUM ('OWNER', 'CLIENT');

ALTER TABLE "CampaignClientAccess"
ADD COLUMN "minScoreToAlert" INTEGER,
ADD COLUMN "notificationsEnabledAt" TIMESTAMP(3);

UPDATE "CampaignClientAccess" AS access
SET
    "minScoreToAlert" = campaign."minScoreToAlert",
    "notificationsEnabledAt" = CURRENT_TIMESTAMP
FROM "Campaign" AS campaign
WHERE campaign."id" = access."campaignId";

UPDATE "CampaignClientAccess" AS access
SET
    "userId" = matched_user."id",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "User" AS matched_user
WHERE matched_user."email" IS NOT NULL
  AND LOWER(BTRIM(matched_user."email")) = access."normalizedEmail"
  AND access."userId" IS DISTINCT FROM matched_user."id";

ALTER TABLE "CampaignClientAccess"
ALTER COLUMN "minScoreToAlert" SET NOT NULL,
ALTER COLUMN "minScoreToAlert" SET DEFAULT 75,
ALTER COLUMN "notificationsEnabledAt" SET NOT NULL,
ALTER COLUMN "notificationsEnabledAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Notification"
ADD COLUMN "recipientUserId" TEXT,
ADD COLUMN "recipientRole" "NotificationRecipientRole" NOT NULL DEFAULT 'OWNER',
ADD COLUMN "campaignClientAccessId" TEXT,
ADD COLUMN "campaignDisplayName" TEXT;

UPDATE "Notification" AS notification
SET
    "recipientUserId" = lead."userId",
    "campaignDisplayName" = campaign."name"
FROM "Lead" AS lead
JOIN "Campaign" AS campaign ON campaign."id" = lead."campaignId"
WHERE notification."leadId" = lead."id";

ALTER TABLE "Notification"
ALTER COLUMN "recipientUserId" SET NOT NULL,
ALTER COLUMN "campaignDisplayName" SET NOT NULL;

CREATE UNIQUE INDEX "Notification_leadId_recipientUserId_channel_key"
ON "Notification"("leadId", "recipientUserId", "channel");

CREATE INDEX "Notification_recipientUserId_createdAt_idx"
ON "Notification"("recipientUserId", "createdAt" DESC);

CREATE INDEX "Notification_campaignClientAccessId_createdAt_idx"
ON "Notification"("campaignClientAccessId", "createdAt" DESC);

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_campaignClientAccessId_fkey"
FOREIGN KEY ("campaignClientAccessId") REFERENCES "CampaignClientAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
