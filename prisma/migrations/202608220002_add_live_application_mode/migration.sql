DO $$
BEGIN
  CREATE TYPE "SaasAppMode" AS ENUM ('DAILY', 'LIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "SaasConfig"
  ADD COLUMN IF NOT EXISTS "appMode" "SaasAppMode" NOT NULL DEFAULT 'DAILY';

UPDATE "SaasConfig"
SET "appMode" = CASE
  WHEN "campaignLeadLayout" = 'INBOX' THEN 'LIVE'::"SaasAppMode"
  ELSE 'DAILY'::"SaasAppMode"
END;

ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "regions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "handledAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Lead_campaignId_status_createdAt_idx"
  ON "Lead"("campaignId", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Notification_recipientUserId_handledAt_createdAt_idx"
  ON "Notification"("recipientUserId", "handledAt", "createdAt" DESC);
