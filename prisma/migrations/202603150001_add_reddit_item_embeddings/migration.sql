CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "RedditItemEmbedding" (
    "id" TEXT NOT NULL,
    "redditItemId" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "sourceText" TEXT,
    "dimensions" INTEGER NOT NULL DEFAULT 1536,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedditItemEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RedditItemEmbedding_redditItemId_key" ON "RedditItemEmbedding"("redditItemId");
CREATE INDEX "RedditItemEmbedding_model_idx" ON "RedditItemEmbedding"("model");

ALTER TABLE "RedditItemEmbedding"
ADD CONSTRAINT "RedditItemEmbedding_redditItemId_fkey"
FOREIGN KEY ("redditItemId") REFERENCES "RedditItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Create a vector index after you have embeddings flowing and know the query pattern.
-- Example:
-- CREATE INDEX "RedditItemEmbedding_embedding_hnsw_idx"
-- ON "RedditItemEmbedding"
-- USING hnsw ("embedding" vector_cosine_ops);
