import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { getDailyRssSubredditPool } from "@/lib/daily-rss-subreddit-pool";
import { getSemanticLookbackHours } from "@/lib/manual-campaign-semantic";
import { prisma } from "@/lib/prisma";
import { Worker } from "bullmq";

import {
  dailySemanticCandidateBatchSize,
  dailySemanticInitialLookbackHours,
  dailySemanticLookbackHours,
  dailySemanticTopKPerQuery,
  semanticMatchThreshold,
  workerRedisConnection,
  workerSemanticConcurrency,
} from "./config";
import {
  markCampaignRunCompleted,
  markCampaignRunFailed,
  markCampaignRunProcessing,
  refreshDailySemanticCampaignRunStats,
} from "./campaign-runs";
import { upsertDailySemanticScans } from "./daily-semantic-scans";
import { workerLogger } from "./logger";
import {
  dailySemanticCampaignJobName,
  dailySemanticQueueName,
  enqueueLeadClassification,
  type DailySemanticCampaignJobData,
} from "./queues";

type CandidateRow = {
  redditItemId: string;
};

type MatchRow = {
  redditItemId: string;
  queryId: string;
  queryText: string;
  similarity: number;
};

const worker = new Worker<DailySemanticCampaignJobData>(
  dailySemanticQueueName,
  async (job) => {
    if (job.name === dailySemanticCampaignJobName) {
      return runDailySemanticCampaign(job.data, job.id ?? "unknown");
    }

    workerLogger.warn({ jobId: job.id, name: job.name }, "Ignoring unsupported daily semantic job");
    return;
  },
  {
    connection: workerRedisConnection,
    concurrency: workerSemanticConcurrency,
  },
);

worker.on("completed", (job) => {
  workerLogger.info({ jobId: job.id, name: job.name }, "Daily semantic job completed");
});

worker.on("failed", (job, error) => {
  workerLogger.error({ jobId: job?.id, name: job?.name, error }, "Daily semantic job failed");
});

workerLogger.info("Daily semantic worker started");

async function runDailySemanticCampaign(data: DailySemanticCampaignJobData, jobId: string) {
  try {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: data.campaignId,
      isActive: true,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!campaign) {
    await markCampaignRunCompleted(data.campaignRunId, "Skipping daily semantic search for inactive or missing campaign.");
    workerLogger.info({ jobId, campaignId: data.campaignId }, "Skipping daily semantic search for inactive or missing campaign");
    return { skipped: true, reason: "campaign_missing_or_inactive" };
  }

  await markCampaignRunProcessing(data.campaignRunId, "Starting daily semantic search for this campaign.");

  const subredditPool = await getDailyRssSubredditPool();
  const subreddits = subredditPool.enabledSubreddits;

  if (subreddits.length === 0) {
    const stats = {
      globalSubredditCount: 0,
      disabledSubredditCount: subredditPool.disabledSubreddits.length,
    };
    await markCampaignRunCompleted(
      data.campaignRunId,
      "Skipping daily semantic search because no subreddits are enabled for daily RSS polling.",
      stats,
    );
    workerLogger.info(
      { jobId, campaignId: campaign.id, ...stats },
      "Skipping daily semantic search because the global daily RSS subreddit pool is empty",
    );
    return { skipped: true, reason: "no_enabled_daily_rss_subreddits", ...stats };
  }

  const semanticQueryCount = await prisma.campaignSemanticQuery.count({
    where: {
      campaignId: campaign.id,
    },
  });

  if (semanticQueryCount === 0) {
    await markCampaignRunCompleted(data.campaignRunId, "Skipping daily semantic search because campaign has no semantic queries.");
    workerLogger.info({ jobId, campaignId: campaign.id }, "Skipping daily semantic search because campaign has no semantic queries");
    return { skipped: true, reason: "no_semantic_queries" };
  }

  const startedAt = Date.now();
  const hasCompletedSemanticRun = Boolean(await prisma.campaignRun.findFirst({
    where: {
      campaignId: campaign.id,
      id: data.campaignRunId ? { not: data.campaignRunId } : undefined,
      status: "COMPLETED",
      trigger: {
        in: ["DAILY_SEMANTIC", "MANUAL_SEMANTIC"],
      },
    },
    select: {
      id: true,
    },
  }));
  const lookbackHours = getSemanticLookbackHours({
    hasCompletedSemanticRun,
    initialLookbackHours: dailySemanticInitialLookbackHours,
    recurringLookbackHours: dailySemanticLookbackHours,
  });
  const lookbackSince = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  let scannedPosts = 0;
  let matchedPosts = 0;
  let noMatchPosts = 0;
  let createdLeads = 0;
  let reusedLeads = 0;
  let queuedClassifications = 0;

  while (true) {
    const candidateRows = await loadCandidateRows({
      campaignId: campaign.id,
      lookbackSince,
      subreddits,
    });

    if (candidateRows.length === 0) {
      break;
    }

    const candidateIds = candidateRows.map((row) => row.redditItemId);
    const matchRows = await findBestMatches({
      campaignId: campaign.id,
      redditItemIds: candidateIds,
    });
    const matchByRedditItemId = new Map(matchRows.map((row) => [row.redditItemId, row]));

    const noMatchScans = candidateIds
      .filter((redditItemId) => !matchByRedditItemId.has(redditItemId))
      .map((redditItemId) => ({
        campaignId: campaign.id,
        campaignRunId: data.campaignRunId,
        redditItemId,
        status: "NO_MATCH" as const,
      }));
    const matchedScans = matchRows.map((match) => ({
      campaignId: campaign.id,
      campaignRunId: data.campaignRunId,
      redditItemId: match.redditItemId,
      status: "MATCHED" as const,
      bestScore: match.similarity,
      bestQueryId: match.queryId,
      bestQueryText: match.queryText,
    }));

    await upsertDailySemanticScans([...noMatchScans, ...matchedScans]);

    for (const match of matchRows) {
      const lead = await ensureLead({
        campaignId: campaign.id,
        redditItemId: match.redditItemId,
        userId: campaign.userId,
      });

      if (lead.created) {
        createdLeads += 1;
      } else {
        reusedLeads += 1;
      }

      if (!lead.hasAi) {
        await enqueueLeadClassification({
          leadId: lead.id,
          campaignId: campaign.id,
          campaignRunId: data.campaignRunId,
          trigger: "daily_semantic",
        });
        queuedClassifications += 1;
      }
    }

    scannedPosts += candidateIds.length;
    matchedPosts += matchedScans.length;
    noMatchPosts += noMatchScans.length;
  }

  const durationMs = Date.now() - startedAt;

  workerLogger.info(
    {
      jobId,
      campaignId: campaign.id,
      scannedPosts,
      matchedPosts,
      noMatchPosts,
      createdLeads,
      reusedLeads,
      queuedClassifications,
      globalSubredditCount: subreddits.length,
      disabledSubredditCount: subredditPool.disabledSubreddits.length,
      lookbackHours,
      runSource: data.source ?? "scheduled",
      durationMs,
    },
    "Daily semantic campaign search completed",
  );

  const stats = {
    scannedPosts,
    matchedPosts,
    noMatchPosts,
    createdLeads,
    reusedLeads,
    queuedClassifications,
    globalSubredditCount: subreddits.length,
    disabledSubredditCount: subredditPool.disabledSubreddits.length,
    lookbackHours,
    runSource: data.source ?? "scheduled",
    totalLeadsFound: matchedPosts,
    pendingClassifications: queuedClassifications,
    durationMs,
  };

  if (queuedClassifications > 0) {
    await markCampaignRunProcessing(data.campaignRunId, "Daily semantic leads are waiting for AI scoring.", stats);
  } else {
    await markCampaignRunCompleted(data.campaignRunId, "Daily semantic search complete. No new AI scoring was needed.", stats);
  }

  await refreshDailySemanticCampaignRunStats(data.campaignRunId);

  return {
    campaignId: campaign.id,
    ...stats,
  };
  } catch (error) {
    await markCampaignRunFailed(
      data.campaignRunId,
      error instanceof Error ? error.message : "Daily semantic search failed.",
    );
    throw error;
  }
}

async function loadCandidateRows({
  campaignId,
  lookbackSince,
  subreddits,
}: {
  campaignId: string;
  lookbackSince: Date;
  subreddits: string[];
}) {
  return prisma.$queryRaw<CandidateRow[]>(
    Prisma.sql`
      SELECT "ri"."id" AS "redditItemId"
      FROM "RedditItem" "ri"
      JOIN "RedditItemEmbedding" "rie"
        ON "rie"."redditItemId" = "ri"."id"
      LEFT JOIN "CampaignDailySemanticScan" "scan"
        ON "scan"."campaignId" = ${campaignId}
       AND "scan"."redditItemId" = "ri"."id"
      WHERE "ri"."type" = 'POST'
        AND "ri"."subreddit" IN (${Prisma.join(subreddits)})
        AND "ri"."fetchedAt" >= ${lookbackSince}
        AND "rie"."embedding" IS NOT NULL
        AND "scan"."id" IS NULL
      ORDER BY "ri"."fetchedAt" DESC
      LIMIT ${dailySemanticCandidateBatchSize}
    `,
  );
}

async function findBestMatches({
  campaignId,
  redditItemIds,
}: {
  campaignId: string;
  redditItemIds: string[];
}) {
  if (redditItemIds.length === 0) {
    return [];
  }

  const effectiveTopK = Math.max(dailySemanticTopKPerQuery, redditItemIds.length);

  return prisma.$queryRaw<MatchRow[]>(
    Prisma.sql`
      WITH "queryMatches" AS (
        SELECT
          "candidate"."redditItemId" AS "redditItemId",
          "csq"."id" AS "queryId",
          "csq"."queryText" AS "queryText",
          "candidate"."similarity" AS "similarity"
        FROM "CampaignSemanticQuery" "csq"
        CROSS JOIN LATERAL (
          SELECT
            "rie"."redditItemId" AS "redditItemId",
            1 - ("rie"."embedding" <=> "csq"."embedding") AS "similarity"
          FROM "RedditItemEmbedding" "rie"
          WHERE "rie"."redditItemId" IN (${Prisma.join(redditItemIds)})
            AND "rie"."embedding" IS NOT NULL
          ORDER BY "rie"."embedding" <=> "csq"."embedding" ASC
          LIMIT ${effectiveTopK}
        ) "candidate"
        WHERE "csq"."campaignId" = ${campaignId}
          AND "csq"."embedding" IS NOT NULL
          AND "candidate"."similarity" >= ${semanticMatchThreshold}
      )
      SELECT DISTINCT ON ("redditItemId")
        "redditItemId",
        "queryId",
        "queryText",
        "similarity"
      FROM "queryMatches"
      ORDER BY "redditItemId", "similarity" DESC
    `,
  );
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
      hasAi: false,
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
          ai: {
            select: {
              id: true,
            },
          },
        },
      });

      if (existing) {
        return {
          id: existing.id,
          created: false,
          hasAi: Boolean(existing.ai),
        };
      }
    }

    throw error;
  }
}
