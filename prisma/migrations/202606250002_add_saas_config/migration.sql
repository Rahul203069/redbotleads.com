CREATE TABLE "SaasConfig" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "subredditSuggestionCount" INTEGER NOT NULL DEFAULT 40,
  "leadScoringModel" TEXT NOT NULL DEFAULT 'gpt-5-mini',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SaasConfig_pkey" PRIMARY KEY ("id")
);
