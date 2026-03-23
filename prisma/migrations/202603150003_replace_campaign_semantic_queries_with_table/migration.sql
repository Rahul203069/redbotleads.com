ALTER TABLE "Campaign"
DROP COLUMN IF EXISTS "semanticQueries";

CREATE TABLE "CampaignSemanticQuery" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "category" TEXT,
    "dimensions" INTEGER NOT NULL DEFAULT 1536,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSemanticQuery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignSemanticQuery_campaignId_createdAt_idx"
ON "CampaignSemanticQuery"("campaignId", "createdAt" DESC);

ALTER TABLE "CampaignSemanticQuery"
ADD CONSTRAINT "CampaignSemanticQuery_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Create a vector index after you start querying semantic campaign phrases at scale.
-- Example:
-- CREATE INDEX "CampaignSemanticQuery_embedding_hnsw_idx"
-- ON "CampaignSemanticQuery"
-- USING hnsw ("embedding" vector_cosine_ops);
