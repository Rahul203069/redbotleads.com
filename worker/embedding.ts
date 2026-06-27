import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Worker } from "bullmq";

import { generateEmbeddings } from "@/lib/openai";
import { updateCampaignProgress } from "./campaign-sync";
import {
  workerEmbeddingBatchMaxChars,
  workerEmbeddingBatchSize,
  workerEmbeddingConcurrency,
  workerRedisConnection,
} from "./config";
import { workerLogger } from "./logger";
import {
  embeddingQueueName,
  enqueueLeadSemanticMatchBatch,
  type EmbeddingJobData,
  type LeadEmbeddingBatchItem,
  type RedditItemEmbeddingSource,
  type SemanticJobData,
} from "./queues";

type LeadSemanticData = Extract<SemanticJobData, { leadId: string }>;

type RedditItemForEmbedding = {
  id: string;
  title: string | null;
  body: string | null;
  description: string | null;
  subreddit: string;
  type: string;
  embedding: {
    model: string | null;
    dimensions: number;
    sourceText: string | null;
  } | null;
};

type EmbeddingInputRecord = {
  item: LeadEmbeddingBatchItem;
  redditItem: RedditItemForEmbedding;
  sourceText: string;
};

const worker = new Worker<EmbeddingJobData>(
  embeddingQueueName,
  async (job) => {
    if (job.name === "EMBED_LEAD_BATCH") {
      if (!("items" in job.data)) {
        workerLogger.warn({ jobId: job.id, name: job.name, data: job.data }, "Embedding batch job payload is missing items");
        return;
      }

      return runLeadEmbeddingBatch(job.data, job.id ?? "unknown");
    }

    if (job.name === "EMBED_LEAD") {
      if (!("leadId" in job.data) || !("campaignId" in job.data)) {
        workerLogger.warn({ jobId: job.id, name: job.name, data: job.data }, "Embedding lead job payload is missing lead identifiers");
        return;
      }

      return runLeadEmbeddingBatch(
        {
          campaignId: job.data.campaignId,
          campaignRunId: job.data.campaignRunId,
          items: [
            {
              leadId: job.data.leadId,
              redditItemId: job.data.redditItemId,
            },
          ],
        },
        job.id ?? "unknown",
      );
    }

    if (job.name === "EMBED_REDDIT_ITEM") {
      if (!("redditItemId" in job.data)) {
        workerLogger.warn({ jobId: job.id, name: job.name, data: job.data }, "Embedding Reddit item job payload is missing item identifier");
        return;
      }

      const source = "source" in job.data ? job.data.source : undefined;
      return runRedditItemEmbedding(job.data.redditItemId, job.id ?? "unknown", source);
    }

    workerLogger.warn({ jobId: job.id, name: job.name }, "Ignoring unsupported embedding job");
  },
  {
    connection: workerRedisConnection,
    concurrency: workerEmbeddingConcurrency,
  },
);

worker.on("completed", (job) => {
  workerLogger.info({ jobId: job.id, name: job.name }, "Embedding job completed");
});

worker.on("failed", (job, error) => {
  workerLogger.error({ jobId: job?.id, name: job?.name, error }, "Embedding job failed");
});

workerLogger.info("Embedding worker started");

async function runLeadEmbeddingBatch(
  data: Extract<EmbeddingJobData, { items: LeadEmbeddingBatchItem[] }>,
  jobId: string,
) {
  const items = dedupeLeadEmbeddingItems(data.items);

  if (items.length === 0) {
    workerLogger.warn({ jobId, campaignId: data.campaignId }, "Skipping empty lead embedding batch");
    return { skipped: true, reason: "empty_embedding_batch" };
  }

  const redditItems = await loadRedditItems(items.map((item) => item.redditItemId));
  const redditItemsById = new Map(redditItems.map((item) => [item.id, item]));
  const semanticItems: LeadSemanticData[] = [];
  const embeddingInputs: EmbeddingInputRecord[] = [];
  let missingItems = 0;
  let emptySourceTexts = 0;
  let reusedEmbeddings = 0;
  let generatedEmbeddings = 0;

  for (const item of items) {
    const redditItem = redditItemsById.get(item.redditItemId);

    if (!redditItem) {
      missingItems += 1;
      workerLogger.warn({ jobId, redditItemId: item.redditItemId, leadId: item.leadId }, "Reddit item not found for embedding");
      continue;
    }

    const sourceText = buildEmbeddingText({
      body: redditItem.body,
      description: redditItem.description,
      title: redditItem.title,
    });

    if (!sourceText) {
      emptySourceTexts += 1;
      workerLogger.warn({ jobId, redditItemId: item.redditItemId, leadId: item.leadId }, "Skipping embedding because there is no usable source text");
      continue;
    }

    if (redditItem.embedding?.sourceText === sourceText) {
      reusedEmbeddings += 1;
      semanticItems.push({
        leadId: item.leadId,
        campaignId: data.campaignId,
        campaignRunId: data.campaignRunId,
        redditItemId: item.redditItemId,
      });
      continue;
    }

    embeddingInputs.push({
      item,
      redditItem,
      sourceText,
    });
  }

  for (const chunk of chunkEmbeddingInputs(embeddingInputs)) {
    const campaignUserId = await getCampaignUserId(data.campaignId);
    const result = await generateEmbeddings({
      input: chunk.map((record) => record.sourceText),
      usage: {
        userId: campaignUserId,
        campaignId: data.campaignId,
        campaignRunId: data.campaignRunId,
        operation: "lead_embedding",
        metadata: {
          jobId,
          itemCount: chunk.length,
        },
      },
    });

    for (let index = 0; index < chunk.length; index += 1) {
      const record = chunk[index];
      const embedding = result.embeddings[index];

      await upsertRedditItemEmbedding({
        redditItemId: record.redditItem.id,
        sourceText: record.sourceText,
        model: result.model,
        dimensions: result.dimensions,
        embedding,
      });

      generatedEmbeddings += 1;
      semanticItems.push({
        leadId: record.item.leadId,
        campaignId: data.campaignId,
        campaignRunId: data.campaignRunId,
        redditItemId: record.item.redditItemId,
      });
    }
  }

  if (semanticItems.length > 0) {
    await continueLeadSemanticBatchFlow(data.campaignId, semanticItems);
  }

  workerLogger.info(
    {
      jobId,
      campaignId: data.campaignId,
      requestedItems: data.items.length,
      uniqueItems: items.length,
      reusedEmbeddings,
      generatedEmbeddings,
      missingItems,
      emptySourceTexts,
      semanticQueued: semanticItems.length,
    },
    "Lead embedding batch completed",
  );

  return {
    requestedItems: data.items.length,
    uniqueItems: items.length,
    reusedEmbeddings,
    generatedEmbeddings,
    missingItems,
    emptySourceTexts,
    semanticQueued: semanticItems.length,
  };
}

async function runRedditItemEmbedding(
  redditItemId: string,
  jobId: string,
  source?: RedditItemEmbeddingSource,
) {
  const [redditItem] = await loadRedditItems([redditItemId]);

  if (!redditItem) {
    workerLogger.warn({ jobId, redditItemId }, "Reddit item not found for embedding");
    return { skipped: true, reason: "reddit_item_not_found" };
  }

  const sourceText = buildEmbeddingText({
    body: redditItem.body,
    description: redditItem.description,
    title: redditItem.title,
  });

  if (!sourceText) {
    workerLogger.warn({ jobId, redditItemId }, "Skipping embedding because there is no usable source text");
    return { skipped: true, reason: "empty_source_text" };
  }

  if (redditItem.embedding?.sourceText === sourceText) {
    workerLogger.info(
      {
        jobId,
        redditItemId: redditItem.id,
        type: redditItem.type,
        subreddit: redditItem.subreddit,
        dimensions: redditItem.embedding.dimensions,
        model: redditItem.embedding.model,
        sourceLength: sourceText.length,
      },
      "Reusing existing Reddit item embedding",
    );

    return {
      redditItemId: redditItem.id,
      dimensions: redditItem.embedding.dimensions,
      model: redditItem.embedding.model,
      sourceLength: sourceText.length,
      reused: true,
    };
  }

  const result = await generateEmbeddings({
    input: [sourceText],
    usage: source === "subreddit_daily_ingest"
      ? {
          operation: "daily_reddit_item_embedding",
          metadata: {
            jobId,
            redditItemId: redditItem.id,
            source,
            subreddit: redditItem.subreddit,
          },
        }
      : undefined,
  });

  await upsertRedditItemEmbedding({
    redditItemId: redditItem.id,
    sourceText,
    model: result.model,
    dimensions: result.dimensions,
    embedding: result.embeddings[0],
  });

  workerLogger.info(
    {
      jobId,
      redditItemId: redditItem.id,
      type: redditItem.type,
      subreddit: redditItem.subreddit,
      dimensions: result.dimensions,
      model: result.model,
      sourceLength: sourceText.length,
    },
    "Reddit item embedded with OpenAI",
  );

  return {
    redditItemId: redditItem.id,
    dimensions: result.dimensions,
    model: result.model,
    sourceLength: sourceText.length,
  };
}

async function loadRedditItems(redditItemIds: string[]) {
  const uniqueIds = [...new Set(redditItemIds)];

  if (uniqueIds.length === 0) {
    return [];
  }

  return prisma.redditItem.findMany({
    where: {
      id: {
        in: uniqueIds,
      },
    },
    select: {
      id: true,
      title: true,
      body: true,
      description: true,
      subreddit: true,
      type: true,
      embedding: {
        select: {
          model: true,
          dimensions: true,
          sourceText: true,
        },
      },
    },
  });
}

async function upsertRedditItemEmbedding({
  redditItemId,
  sourceText,
  model,
  dimensions,
  embedding,
}: {
  redditItemId: string;
  sourceText: string;
  model: string;
  dimensions: number;
  embedding: number[];
}) {
  const vectorLiteral = `[${embedding.join(",")}]`;

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "RedditItemEmbedding" (
        "id",
        "redditItemId",
        "provider",
        "model",
        "sourceText",
        "dimensions",
        "embedding",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${redditItemId},
        ${"openai"},
        ${model},
        ${sourceText},
        ${dimensions},
        CAST(${vectorLiteral} AS vector),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("redditItemId")
      DO UPDATE SET
        "provider" = EXCLUDED."provider",
        "model" = EXCLUDED."model",
        "sourceText" = EXCLUDED."sourceText",
        "dimensions" = EXCLUDED."dimensions",
        "embedding" = EXCLUDED."embedding",
        "updatedAt" = CURRENT_TIMESTAMP
    `,
  );
}

async function continueLeadSemanticBatchFlow(campaignId: string, items: LeadSemanticData[]) {
  const embeddedLeads = await countEmbeddedLeads(campaignId);

  await updateCampaignProgress(
    campaignId,
    "CLASSIFYING",
    `Embeddings prepared for ${embeddedLeads} total lead${embeddedLeads === 1 ? "" : "s"}. Moving ${items.length} lead${items.length === 1 ? "" : "s"} into semantic filtering.`,
    {
      embeddedLeads,
    },
  );

  await enqueueLeadSemanticMatchBatch(items);
}

function dedupeLeadEmbeddingItems(items: LeadEmbeddingBatchItem[]) {
  const seenLeadIds = new Set<string>();
  const dedupedItems: LeadEmbeddingBatchItem[] = [];

  for (const item of items) {
    if (seenLeadIds.has(item.leadId)) {
      continue;
    }

    seenLeadIds.add(item.leadId);
    dedupedItems.push(item);
  }

  return dedupedItems;
}

function chunkEmbeddingInputs(records: EmbeddingInputRecord[]) {
  const chunks: EmbeddingInputRecord[][] = [];
  let currentChunk: EmbeddingInputRecord[] = [];
  let currentChars = 0;

  for (const record of records) {
    const nextChars = currentChars + record.sourceText.length;
    const shouldStartNextChunk =
      currentChunk.length >= workerEmbeddingBatchSize ||
      (currentChunk.length > 0 && nextChars > workerEmbeddingBatchMaxChars);

    if (shouldStartNextChunk) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }

    currentChunk.push(record);
    currentChars += record.sourceText.length;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function buildEmbeddingText(input: {
  title: string | null;
  body: string | null;
  description: string | null;
}) {
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);
  const description = normalizeText(input.description);

  let primaryContent = "";

  if (body && !description) {
    primaryContent = body;
  } else if (description && !body) {
    primaryContent = description;
  } else if (body && description) {
    primaryContent = body.length >= description.length ? body : description;
  }

  return [title ? `Title: ${title}` : "", primaryContent ? `Content: ${primaryContent}` : ""]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

async function countEmbeddedLeads(campaignId: string) {
  return prisma.lead.count({
    where: {
      campaignId,
      redditItem: {
        embedding: {
          isNot: null,
        },
      },
    },
  });
}

async function getCampaignUserId(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: {
      id: campaignId,
    },
    select: {
      userId: true,
    },
  });

  return campaign?.userId ?? null;
}
