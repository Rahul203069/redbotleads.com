CREATE TYPE "CampaignSemanticSearchScope" AS ENUM ('CAMPAIGN', 'GLOBAL');

ALTER TABLE "Campaign"
ADD COLUMN "semanticSearchScope" "CampaignSemanticSearchScope" NOT NULL DEFAULT 'GLOBAL';

ALTER TABLE "Campaign"
ALTER COLUMN "semanticSearchScope" SET DEFAULT 'CAMPAIGN';
