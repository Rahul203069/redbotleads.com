"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { generateEmbeddings } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

const EMBEDDING_BATCH_SIZE = 100;
const INSERT_BATCH_SIZE = 100;
const MIN_QUERY_TEXT_LENGTH = 3;
const MAX_QUERY_TEXT_LENGTH = 700;
const MAX_QUERY_CATEGORY_LENGTH = 80;

type ParsedSemanticQuery = {
  category: string | null;
  text: string;
};

type SavedSemanticQuery = {
  category: string | null;
  id: string;
  queryText: string;
};

type EmbeddedSemanticQuery = SavedSemanticQuery & {
  dimensions: number;
  embedding: number[];
};

export type SaveCampaignSemanticQueriesResult =
  | {
      status: "success";
      message: string;
      queries: SavedSemanticQuery[];
    }
  | {
      status: "error";
      message: string;
    };

export async function saveCampaignSemanticQueries(formData: FormData): Promise<SaveCampaignSemanticQueriesResult> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to edit semantic queries.",
    };
  }

  const campaignId = String(formData.get("campaignId") ?? "").trim();

  if (!campaignId) {
    return {
      status: "error",
      message: "Select a campaign before saving semantic queries.",
    };
  }

  const parsedQueries = parseQueries(formData.get("queriesJson"));

  if (parsedQueries.status === "error") {
    return {
      status: "error",
      message: parsedQueries.message,
    };
  }

  const campaign = await prisma.campaign.findUnique({
    where: {
      id: campaignId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!campaign) {
    return {
      status: "error",
      message: "Campaign was not found.",
    };
  }

  let savedQueries: EmbeddedSemanticQuery[];

  try {
    savedQueries = await embedSemanticQueries({
      campaignId: campaign.id,
      queries: parsedQueries.queries,
      userId: session.user.id,
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `Embedding failed: ${error.message}` : "Embedding failed while saving semantic queries.",
    };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM "CampaignSemanticQuery" WHERE "campaignId" = ${campaign.id}`,
        );

        for (const chunk of chunkArray(savedQueries, INSERT_BATCH_SIZE)) {
          const rows = chunk.map((query) => {
            const vectorLiteral = `[${query.embedding.join(",")}]`;

            return Prisma.sql`(
              ${query.id},
              ${campaign.id},
              ${query.queryText},
              ${query.category},
              ${query.dimensions},
              CAST(${vectorLiteral} AS vector),
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )`;
          });

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
      },
      {
        maxWait: 5_000,
        timeout: 60_000,
      },
    );
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `Save failed: ${error.message}` : "Save failed while replacing semantic queries.",
    };
  }

  revalidatePath("/admin/analytics");
  revalidatePath("/admin/analytics/playground");
  revalidatePath("/admin/analytics/semantic-queries");

  return {
    status: "success",
    message: `Saved ${savedQueries.length} live semantic ${savedQueries.length === 1 ? "query" : "queries"} for ${campaign.name}.`,
    queries: savedQueries.map((query) => ({
      category: query.category,
      id: query.id,
      queryText: query.queryText,
    })),
  };
}

function parseQueries(value: FormDataEntryValue | null): { status: "success"; queries: ParsedSemanticQuery[] } | { status: "error"; message: string } {
  if (typeof value !== "string" || !value.trim()) {
    return {
      status: "error",
      message: "Add at least one semantic query.",
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return {
      status: "error",
      message: "Semantic queries JSON is invalid.",
    };
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.semanticQueries)
      ? parsed.semanticQueries
      : null;

  if (!rows) {
    return {
      status: "error",
      message: "Semantic queries must be an array or an object with a semanticQueries array.",
    };
  }

  const queries: ParsedSemanticQuery[] = [];
  const seenTexts = new Set<string>();

  for (const [index, row] of rows.entries()) {
    if (!isRecord(row)) {
      continue;
    }

    const rawText = typeof row.text === "string" ? row.text : typeof row.queryText === "string" ? row.queryText : "";
    const text = rawText.trim();

    if (!text) {
      continue;
    }

    if (text.length < MIN_QUERY_TEXT_LENGTH) {
      return {
        status: "error",
        message: `Query ${index + 1} must be at least ${MIN_QUERY_TEXT_LENGTH} characters.`,
      };
    }

    if (text.length > MAX_QUERY_TEXT_LENGTH) {
      return {
        status: "error",
        message: `Query ${index + 1} must be ${MAX_QUERY_TEXT_LENGTH} characters or less.`,
      };
    }

    const rawCategory = typeof row.category === "string" ? row.category.trim() : "";

    if (rawCategory.length > MAX_QUERY_CATEGORY_LENGTH) {
      return {
        status: "error",
        message: `Query ${index + 1} category must be ${MAX_QUERY_CATEGORY_LENGTH} characters or less.`,
      };
    }

    const dedupeKey = text.replace(/\s+/g, " ").toLowerCase();

    if (seenTexts.has(dedupeKey)) {
      continue;
    }

    queries.push({
      category: rawCategory || null,
      text,
    });
    seenTexts.add(dedupeKey);
  }

  if (queries.length === 0) {
    return {
      status: "error",
      message: "Add at least one semantic query with 3 or more characters.",
    };
  }

  return {
    status: "success",
    queries,
  };
}

async function embedSemanticQueries({
  campaignId,
  queries,
  userId,
}: {
  campaignId: string;
  queries: ParsedSemanticQuery[];
  userId: string;
}) {
  const savedQueries: EmbeddedSemanticQuery[] = [];

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
          source: "admin_semantic_query_editor",
        },
        operation: "campaign_semantic_query_embedding",
        userId,
      },
    });

    for (const [index, query] of chunk.entries()) {
      savedQueries.push({
        category: query.category,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
