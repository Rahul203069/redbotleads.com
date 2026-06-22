import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Worker } from "bullmq";

import { markCampaignCompleted } from "./campaign-sync";
import { markCampaignRunCompleted } from "./campaign-runs";
import { semanticMatchThreshold, workerRedisConnection, workerSemanticConcurrency } from "./config";
import { workerLogger } from "./logger";
import { enqueueLeadClassification, semanticQueueName, type SemanticJobData } from "./queues";

const SEMANTIC_FILTER_MODEL = "semantic-threshold-filter";
const SEMANTIC_FILTER_PROMPT_VERSION = "semantic-threshold-v1";

const worker = new Worker<SemanticJobData>(
  semanticQueueName,
  async (job) => {
    if (job.name === "SEMANTIC_MATCH_LEAD") {
      if (!("leadId" in job.data) || !("campaignId" in job.data)) {
        workerLogger.warn({ jobId: job.id, name: job.name, data: job.data }, "Semantic lead job payload is missing lead identifiers");
        return;
      }

      return runSemanticMatch(job.data, job.id ?? "unknown");
    }

    if (job.name === "SEMANTIC_MATCH_REDDIT_ITEM") {
      if (!("redditItemId" in job.data) || !("campaignId" in job.data)) {
        workerLogger.warn({ jobId: job.id, name: job.name, data: job.data }, "Semantic Reddit item job payload is missing identifiers");
        return;
      }

      return runRssPollSemanticMatch(job.data, job.id ?? "unknown");
    }

    workerLogger.warn({ jobId: job.id, name: job.name }, "Ignoring unsupported semantic job");
    return;
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

async function runRssPollSemanticMatch(
  data: Extract<SemanticJobData, { redditItemId: string }>,
  jobId: string,
) {
  if (!data.campaignId) {
    workerLogger.warn({ jobId, data }, "Skipping RSS semantic match because campaign id is missing");
    return { skipped: true, reason: "campaign_id_missing" };
  }

  const candidate = await prisma.redditItem.findUnique({
    where: {
      id: data.redditItemId,
    },
    select: {
      id: true,
      subreddit: true,
      embedding: {
        select: {
          redditItemId: true,
        },
      },
    },
  });

  if (!candidate?.embedding) {
    workerLogger.warn(
      { jobId, campaignId: data.campaignId, redditItemId: data.redditItemId },
      "Skipping RSS semantic match because Reddit item embedding is missing",
    );
    return { skipped: true, reason: "embedding_missing" };
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: data.campaignId,
      isActive: true,
      subreddits: {
        has: candidate.subreddit,
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!campaign) {
    workerLogger.info(
      { jobId, campaignId: data.campaignId, redditItemId: data.redditItemId },
      "Skipping RSS semantic match because campaign is inactive, missing, or no longer tracks subreddit",
    );
    return { skipped: true, reason: "campaign_not_eligible" };
  }

  const campaignQueryCount = await prisma.campaignSemanticQuery.count({
    where: {
      campaignId: campaign.id,
    },
  });

  if (campaignQueryCount === 0) {
    workerLogger.info(
      { jobId, campaignId: campaign.id, redditItemId: candidate.id },
      "Skipping RSS semantic match because campaign has no semantic query embeddings",
    );
    return { skipped: true, reason: "no_campaign_semantic_queries" };
  }

  const bestMatch = await findBestSemanticMatch({
    campaignId: campaign.id,
    redditItemId: candidate.id,
  });

  if (!bestMatch) {
    workerLogger.info(
      { jobId, campaignId: campaign.id, redditItemId: candidate.id },
      "Skipping RSS semantic match because usable campaign query embeddings were not found",
    );
    return { skipped: true, reason: "no_usable_campaign_semantic_embeddings" };
  }

  if (bestMatch.similarity < semanticMatchThreshold) {
    workerLogger.info(
      {
        jobId,
        campaignId: campaign.id,
        redditItemId: candidate.id,
        similarity: bestMatch.similarity,
      },
      "RSS candidate failed semantic threshold and no lead was created",
    );

    return {
      redditItemId: candidate.id,
      similarity: bestMatch.similarity,
      matchedQuery: bestMatch.queryText,
      passed: false,
    };
  }

  const lead = await ensureLead({
    campaignId: campaign.id,
    userId: campaign.userId,
    redditItemId: candidate.id,
  });

  await enqueueLeadClassification({
    leadId: lead.id,
    campaignId: campaign.id,
    campaignRunId: data.campaignRunId,
    trigger: "rss_poll",
  });

  workerLogger.info(
    {
      jobId,
      leadId: lead.id,
      campaignId: campaign.id,
      redditItemId: candidate.id,
      bestQueryId: bestMatch.queryId,
      bestQueryText: bestMatch.queryText,
      similarity: bestMatch.similarity,
      createdLead: lead.created,
    },
    "RSS candidate passed semantic threshold and was queued for classification",
  );

  return {
    leadId: lead.id,
    redditItemId: candidate.id,
    similarity: bestMatch.similarity,
    matchedQuery: bestMatch.queryText,
    passed: true,
    createdLead: lead.created,
  };
}

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
      campaignRunId: data.campaignRunId,
    });

    workerLogger.info(
      { jobId, leadId: lead.id, campaignId: lead.campaignId },
      "No semantic queries configured, bypassing semantic filter and enqueueing classification",
    );

    return { bypassed: true, reason: "no_campaign_semantic_queries" };
  }

  const bestMatch = await findBestSemanticMatch({
    campaignId: lead.campaignId,
    redditItemId: lead.redditItemId,
  });

  if (!bestMatch) {
    throw new Error("Semantic matching could not find embeddings for the lead or campaign queries.");
  }

  if (bestMatch.similarity >= semanticMatchThreshold) {
    await enqueueLeadClassification({
      leadId: lead.id,
      campaignId: lead.campaignId,
      campaignRunId: data.campaignRunId,
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
      summary: `Filtered out by semantic threshold (${bestMatch.similarity.toFixed(3)} < ${semanticMatchThreshold.toFixed(2)}).`,
      painPoints: [],
    },
    create: {
      leadId: lead.id,
      model: SEMANTIC_FILTER_MODEL,
      promptVersion: SEMANTIC_FILTER_PROMPT_VERSION,
      category: bestMatch.category ?? "semantic_filtered",
      summary: `Filtered out by semantic threshold (${bestMatch.similarity.toFixed(3)} < ${semanticMatchThreshold.toFixed(2)}).`,
      painPoints: [],
    },
  });

  const remainingLeads = await countRemainingLeadProcessing(lead.campaignId);

  if (remainingLeads === 0) {
    const semanticCounts = await countSemanticProgress(lead.campaignId);

    const stats = {
      semanticCheckedLeads: semanticCounts.checked,
      semanticPassedLeads: semanticCounts.passed,
      semanticFilteredLeads: semanticCounts.filtered,
    };

    await markCampaignCompleted(
      lead.campaignId,
      "Lead processing complete for this campaign sync.",
      stats,
    );
    await markCampaignRunCompleted(data.campaignRunId, "Lead processing complete for this campaign sync.", stats);
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

async function findBestSemanticMatch({
  campaignId,
  redditItemId,
}: {
  campaignId: string;
  redditItemId: string;
}) {
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
        ON "rie"."redditItemId" = ${redditItemId}
      WHERE "csq"."campaignId" = ${campaignId}
        AND "csq"."embedding" IS NOT NULL
        AND "rie"."embedding" IS NOT NULL
      ORDER BY "rie"."embedding" <=> "csq"."embedding" ASC
      LIMIT 1
    `,
  );

  return bestMatch ?? null;
}

async function ensureLead({
  campaignId,
  userId,
  redditItemId,
}: {
  campaignId: string;
  userId: string;
  redditItemId: string;
}) {
  try {
    const lead = await prisma.lead.create({
      data: {
        campaignId,
        userId,
        redditItemId,
      },
      select: {
        id: true,
      },
    });

    return {
      id: lead.id,
      created: true,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.lead.findFirst({
        where: {
          campaignId,
          userId,
          redditItemId,
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        return {
          id: existing.id,
          created: false,
        };
      }
    }

    throw error;
  }
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
