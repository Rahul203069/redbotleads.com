import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Worker } from "bullmq";

import { markCampaignCompleted } from "./campaign-sync";
import { workerRedisConnection, workerSemanticConcurrency } from "./config";
import { workerLogger } from "./logger";
import { enqueueLeadClassification, semanticQueueName, type SemanticJobData } from "./queues";

const SEMANTIC_MATCH_THRESHOLD = 0.55;
const SEMANTIC_FILTER_MODEL = "semantic-threshold-filter";
const SEMANTIC_FILTER_PROMPT_VERSION = "semantic-threshold-v1";

const worker = new Worker<SemanticJobData>(
  semanticQueueName,
  async (job) => {
    if (job.name !== "SEMANTIC_MATCH_LEAD") {
      workerLogger.warn({ jobId: job.id, name: job.name }, "Ignoring unsupported semantic job");
      return;
    }

    if (!("leadId" in job.data) || !("campaignId" in job.data)) {
      workerLogger.warn({ jobId: job.id, name: job.name, data: job.data }, "Semantic lead job payload is missing lead identifiers");
      return;
    }

    return runSemanticMatch(job.data, job.id ?? "unknown");
  },
  {
    connection: workerRedisConnection,
    concurrency: workerSemanticConcurrency,
  },
);

worker.on("completed", (job) => {
  workerLogger.info({ jobId: job.id, name: job.name }, "Semantic job completed");
});

worker.on("failed", (job, error) => {
  workerLogger.error({ jobId: job?.id, name: job?.name, error }, "Semantic job failed");
});

workerLogger.info("Semantic worker started");

async function runSemanticMatch(data: Extract<SemanticJobData, { leadId: string }>, jobId: string) {
  const lead = await prisma.lead.findFirst({
    where: {
      id: data.leadId,
      campaignId: data.campaignId,
      redditItemId: data.redditItemId,
    },
    select: {
      id: true,
      campaignId: true,
      redditItemId: true,
    },
  });

  if (!lead) {
    workerLogger.warn({ jobId, leadId: data.leadId, campaignId: data.campaignId }, "Lead not found for semantic matching");
    return { skipped: true, reason: "lead_not_found" };
  }

  const campaignQueryCount = await prisma.campaignSemanticQuery.count({
    where: {
      campaignId: lead.campaignId,
    },
  });

  if (campaignQueryCount === 0) {
    await enqueueLeadClassification({
      leadId: lead.id,
      campaignId: lead.campaignId,
    });

    workerLogger.info(
      { jobId, leadId: lead.id, campaignId: lead.campaignId },
      "No semantic queries configured, bypassing semantic filter and enqueueing classification",
    );

    return { bypassed: true, reason: "no_campaign_semantic_queries" };
  }

  const [bestMatch] = await prisma.$queryRaw<Array<{
    queryId: string;
    queryText: string;
    category: string | null;
    similarity: number;
  }>>(
    Prisma.sql`
      SELECT
        "csq"."id" AS "queryId",
        "csq"."queryText" AS "queryText",
        "csq"."category" AS "category",
        1 - ("rie"."embedding" <=> "csq"."embedding") AS "similarity"
      FROM "CampaignSemanticQuery" "csq"
      JOIN "RedditItemEmbedding" "rie"
        ON "rie"."redditItemId" = ${lead.redditItemId}
      WHERE "csq"."campaignId" = ${lead.campaignId}
        AND "csq"."embedding" IS NOT NULL
        AND "rie"."embedding" IS NOT NULL
      ORDER BY "rie"."embedding" <=> "csq"."embedding" ASC
      LIMIT 1
    `,
  );

  if (!bestMatch) {
    throw new Error("Semantic matching could not find embeddings for the lead or campaign queries.");
  }

  if (bestMatch.similarity >= SEMANTIC_MATCH_THRESHOLD) {
    await enqueueLeadClassification({
      leadId: lead.id,
      campaignId: lead.campaignId,
    });

    workerLogger.info(
      {
        jobId,
        leadId: lead.id,
        campaignId: lead.campaignId,
        bestQueryId: bestMatch.queryId,
        bestQueryText: bestMatch.queryText,
        similarity: bestMatch.similarity,
      },
      "Lead passed semantic threshold and was queued for classification",
    );

    return {
      leadId: lead.id,
      similarity: bestMatch.similarity,
      matchedQuery: bestMatch.queryText,
      passed: true,
    };
  }

  await prisma.leadAI.upsert({
    where: {
      leadId: lead.id,
    },
    update: {
      model: SEMANTIC_FILTER_MODEL,
      promptVersion: SEMANTIC_FILTER_PROMPT_VERSION,
      category: bestMatch.category ?? "semantic_filtered",
      summary: `Filtered out by semantic threshold (${bestMatch.similarity.toFixed(3)} < ${SEMANTIC_MATCH_THRESHOLD.toFixed(2)}).`,
      painPoints: [],
    },
    create: {
      leadId: lead.id,
      model: SEMANTIC_FILTER_MODEL,
      promptVersion: SEMANTIC_FILTER_PROMPT_VERSION,
      category: bestMatch.category ?? "semantic_filtered",
      summary: `Filtered out by semantic threshold (${bestMatch.similarity.toFixed(3)} < ${SEMANTIC_MATCH_THRESHOLD.toFixed(2)}).`,
      painPoints: [],
    },
  });

  const remainingLeads = await countRemainingLeadProcessing(lead.campaignId);

  if (remainingLeads === 0) {
    const semanticCounts = await countSemanticProgress(lead.campaignId);

    await markCampaignCompleted(
      lead.campaignId,
      "Lead processing complete for this campaign sync.",
      {
        semanticCheckedLeads: semanticCounts.checked,
        semanticPassedLeads: semanticCounts.passed,
        semanticFilteredLeads: semanticCounts.filtered,
      },
    );
  }

  workerLogger.info(
    {
      jobId,
      leadId: lead.id,
      campaignId: lead.campaignId,
      bestQueryId: bestMatch.queryId,
      bestQueryText: bestMatch.queryText,
      similarity: bestMatch.similarity,
    },
    "Lead failed semantic threshold and was filtered before classification",
  );

  return {
    leadId: lead.id,
    similarity: bestMatch.similarity,
    matchedQuery: bestMatch.queryText,
    passed: false,
  };
}

async function countSemanticProgress(campaignId: string) {
  const embedded = await prisma.lead.count({
    where: {
      campaignId,
      redditItem: {
        embedding: {
          isNot: null,
        },
      },
    },
  });
  const filtered = await prisma.lead.count({
    where: {
      campaignId,
      ai: {
        model: SEMANTIC_FILTER_MODEL,
      },
    },
  });
  const passed = Math.max(0, embedded - filtered);

  return {
    checked: embedded,
    passed,
    filtered,
  };
}

async function countRemainingLeadProcessing(campaignId: string) {
  return prisma.lead.count({
    where: {
      campaignId,
      ai: null,
    },
  });
}
