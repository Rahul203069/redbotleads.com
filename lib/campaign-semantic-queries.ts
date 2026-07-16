import { Prisma } from "@/generated/prisma/client";
import { generateEmbeddings } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { normalizeSemanticQueryText, type CleanSemanticQuery } from "@/lib/semantic-queries";

const EMBEDDING_BATCH_SIZE = 100;
const INSERT_BATCH_SIZE = 100;

export type SavedCampaignSemanticQuery = {
  category: string | null;
  id: string;
  queryText: string;
};

type EmbeddedCampaignSemanticQuery = SavedCampaignSemanticQuery & {
  dimensions: number;
  embedding: number[];
};

export async function persistCampaignSemanticQueries({
  campaignId,
  mode,
  queries,
  source,
  userId,
}: {
  campaignId: string;
  mode: "append" | "replace";
  queries: CleanSemanticQuery[];
  source: "admin_campaign_creation" | "admin_semantic_query_editor" | "automatic_campaign_creation";
  userId: string;
}): Promise<SavedCampaignSemanticQuery[]> {
  const uniqueQueries = await removeExistingAndDuplicateQueries({
    campaignId,
    mode,
    queries,
  });

  if (uniqueQueries.length === 0 && mode === "append") {
    return [];
  }

  const embeddedQueries = await embedSemanticQueries({
    campaignId,
    queries: uniqueQueries,
    source,
    userId,
  });

  await prisma.$transaction(
    async (tx) => {
      if (mode === "replace") {
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM "CampaignSemanticQuery" WHERE "campaignId" = ${campaignId}`,
        );
      }

      for (const chunk of chunkArray(embeddedQueries, INSERT_BATCH_SIZE)) {
        const rows = chunk.map((query) => {
          const vectorLiteral = `[${query.embedding.join(",")}]`;

          return Prisma.sql`(
            ${query.id},
            ${campaignId},
            ${query.queryText},
            ${query.category},
            ${query.dimensions},
            CAST(${vectorLiteral} AS vector),
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )`;
        });

        if (rows.length > 0) {
          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO "CampaignSemanticQuery" (
                "id",
                "campaignId",
                "queryText",
                "category",
                "dimensions",
                "embedding",
                "createdAt",
                "updatedAt"
              )
              VALUES ${Prisma.join(rows)}
            `,
          );
        }
      }
    },
    {
      maxWait: 5_000,
      timeout: 60_000,
    },
  );

  return embeddedQueries.map(({ category, id, queryText }) => ({
    category,
    id,
    queryText,
  }));
}

async function removeExistingAndDuplicateQueries({
  campaignId,
  mode,
  queries,
}: {
  campaignId: string;
  mode: "append" | "replace";
  queries: CleanSemanticQuery[];
}) {
  const seen = new Set<string>();

  if (mode === "append") {
    const existingQueries = await prisma.campaignSemanticQuery.findMany({
      where: { campaignId },
      select: { queryText: true },
    });

    for (const query of existingQueries) {
      seen.add(normalizeSemanticQueryText(query.queryText));
    }
  }

  return queries.filter((query) => {
    const key = normalizeSemanticQueryText(query.text);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function embedSemanticQueries({
  campaignId,
  queries,
  source,
  userId,
}: {
  campaignId: string;
  queries: CleanSemanticQuery[];
  source: "admin_campaign_creation" | "admin_semantic_query_editor" | "automatic_campaign_creation";
  userId: string;
}) {
  const savedQueries: EmbeddedCampaignSemanticQuery[] = [];

  for (const chunk of chunkArray(queries, EMBEDDING_BATCH_SIZE)) {
    const embeddingResult = await generateEmbeddings({
      dimensions: 1536,
      input: chunk.map((query) => query.text),
      model: "text-embedding-3-small",
      usage: {
        campaignId,
        metadata: {
          batchSize: chunk.length,
          queryCount: queries.length,
          source,
        },
        operation: "campaign_semantic_query_embedding",
        userId,
      },
    });

    for (const [index, query] of chunk.entries()) {
      savedQueries.push({
        category: query.category || null,
        dimensions: embeddingResult.dimensions,
        embedding: embeddingResult.embeddings[index],
        id: crypto.randomUUID(),
        queryText: query.text,
      });
    }
  }

  return savedQueries;
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}
