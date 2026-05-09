import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Worker } from "bullmq";

import { generateEmbedding } from "@/lib/openai";
import { updateCampaignProgress } from "./campaign-sync";
import { workerEmbeddingConcurrency, workerRedisConnection } from "./config";
import { workerLogger } from "./logger";
import { embeddingQueueName, enqueueLeadSemanticMatch, type EmbeddingJobData } from "./queues";

const worker = new Worker<EmbeddingJobData>(
  embeddingQueueName,
  async (job) => {
    if (job.name !== "EMBED_LEAD" && job.name !== "EMBED_REDDIT_ITEM") {
      workerLogger.warn({ jobId: job.id, name: job.name }, "Ignoring unsupported embedding job");
      return;
    }

    return runEmbedding(job.data, job.id ?? "unknown");
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

async function runEmbedding(data: EmbeddingJobData, jobId: string) {
  const redditItemId = data.redditItemId;
  const redditItem = await prisma.redditItem.findUnique({
    where: {
      id: redditItemId,
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

    if ("leadId" in data && "campaignId" in data) {
      await continueLeadSemanticFlow(data);
    }

    return {
      redditItemId: redditItem.id,
      dimensions: redditItem.embedding.dimensions,
      model: redditItem.embedding.model,
      sourceLength: sourceText.length,
      reused: true,
    };
  }

  try {
    const result = await generateEmbedding({
      input: sourceText,
    });

    const vectorLiteral = `[${result.embedding.join(",")}]`;

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
          ${redditItem.id},
          ${"openai"},
          ${result.model},
          ${sourceText},
          ${result.dimensions},
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

    if ("leadId" in data && "campaignId" in data) {
      await continueLeadSemanticFlow(data);
    }

    return {
      redditItemId: redditItem.id,
      dimensions: result.dimensions,
      model: result.model,
      sourceLength: sourceText.length,
    };
  } catch (error) {
    workerLogger.error({ jobId, redditItemId, error }, "Embedding generation failed");
    throw error;
  }
}

async function continueLeadSemanticFlow(data: Extract<EmbeddingJobData, { leadId: string }>) {
  const embeddedLeads = await countEmbeddedLeads(data.campaignId);

  await updateCampaignProgress(
    data.campaignId,
    "CLASSIFYING",
    `Embeddings prepared for ${embeddedLeads} lead${embeddedLeads === 1 ? "" : "s"}. Moving matched leads into semantic filtering.`,
    {
      embeddedLeads,
    },
  );

  await enqueueLeadSemanticMatch({
    leadId: data.leadId,
    campaignId: data.campaignId,
    redditItemId: data.redditItemId,
  });
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
