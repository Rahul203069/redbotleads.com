ALTER TABLE "SaasConfig"
ALTER COLUMN "leadScoringModel" SET DEFAULT 'gpt-6-luna';

UPDATE "SaasConfig"
SET
  "leadScoringModel" = 'gpt-6-luna',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'global';
