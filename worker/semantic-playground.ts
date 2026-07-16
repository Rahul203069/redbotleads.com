import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { getDailyRssSubredditPool } from "@/lib/daily-rss-subreddit-pool";
import { prisma } from "@/lib/prisma";
import { generateEmbeddings } from "@/lib/openai";
import { getPlaygroundCandidateScopeFromSnapshot } from "@/lib/semantic-playground-scope";
import { normalizeSubredditNames } from "@/lib/subreddit-name";
import { Worker } from "bullmq";

import { classifyLeadWithOpenAI } from "./classification-ai";
import {
  semanticMatchThreshold,
  workerEmbeddingBatchMaxChars,
  workerEmbeddingBatchSize,
  workerRedisConnection,
  workerSemanticConcurrency,
} from "./config";
import { workerLogger } from "./logger";
import {
  semanticPlaygroundQueueName,
  semanticPlaygroundRunJobName,
  type SemanticPlaygroundRunJobData,
} from "./queues";

type PlaygroundQueryRow = {
  id: string;
  queryText: string;
  category: string | null;
};

type MatchRow = {
  redditItemId: string;
  queryId: string;
  queryText: string;
  similarity: number;
};

const worker = new Worker<SemanticPlaygroundRunJobData>(
  semanticPlaygroundQueueName,
  async (job) => {
    if (job.name !== semanticPlaygroundRunJobName) {
      workerLogger.warn({ jobId: job.id, name: job.name }, "Ignoring unsupported semantic playground job");
      return;
    }

    return runSemanticPlayground(job.data, job.id ?? "unknown");
  },
  {
    connection: workerRedisConnection,
    concurrency: workerSemanticConcurrency,
  },
);

worker.on("completed", (job) => {
  workerLogger.info({ jobId: job.id, name: job.name }, "Semantic playground job completed");
});

worker.on("failed", (job, error) => {
  workerLogger.error({ jobId: job?.id, name: job?.name, error }, "Semantic playground job failed");
});

workerLogger.info("Semantic playground worker started");

async function runSemanticPlayground(data: SemanticPlaygroundRunJobData, jobId: string) {
  const startedAt = Date.now();

  try {
    const run = await prisma.campaignSemanticPlaygroundRun.findUnique({
      where: {
        id: data.runId,
      },
      select: {
        id: true,
        userId: true,
        campaignId: true,
        threshold: true,
        fetchedFrom: true,
        fetchedTo: true,
        querySnapshot: true,
        campaign: {
          select: {
            id: true,
            name: true,
            leadType: true,
            description: true,
            keywords: true,
            negativeKeywords: true,
            subreddits: true,
          },
        },
        queries: {
          select: {
            id: true,
            queryText: true,
            category: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!run) {
      workerLogger.warn({ jobId, runId: data.runId }, "Semantic playground run not found");
      return { skipped: true, reason: "run_not_found" };
    }

    const candidateScope = getPlaygroundCandidateScopeFromSnapshot(run.querySnapshot);
    const subredditPool = candidateScope === "GLOBAL"
      ? await getDailyRssSubredditPool()
      : null;
    const subreddits = candidateScope === "GLOBAL"
      ? subredditPool?.enabledSubreddits ?? []
      : normalizeSubredditNames(run.campaign.subreddits);
    const scopeStats = {
      candidateScope,
      subredditCount: subreddits.length,
      ...(candidateScope === "GLOBAL"
        ? { disabledSubredditCount: subredditPool?.disabledSubreddits.length ?? 0 }
        : {}),
    };

    await markRunProcessing(run.id, {
      ...scopeStats,
      totalQueries: run.queries.length,
    });

    if (subreddits.length === 0) {
      const emptyScopeMessage = candidateScope === "GLOBAL"
        ? "No subreddits are enabled in the global daily RSS polling pool."
        : "Campaign has no subreddits to test.";
      await markRunCompleted(run.id, emptyScopeMessage, {
        ...scopeStats,
        totalQueries: run.queries.length,
        candidatePosts: 0,
        semanticMatches: 0,
        classified: 0,
        classificationFailed: 0,
        durationMs: Date.now() - startedAt,
      });
      return {
        skipped: true,
        reason: candidateScope === "GLOBAL" ? "no_global_subreddits" : "no_campaign_subreddits",
        ...scopeStats,
      };
    }

    if (run.queries.length === 0) {
      await markRunCompleted(run.id, "No playground semantic queries were provided.", {
        ...scopeStats,
        totalQueries: 0,
        candidatePosts: 0,
        semanticMatches: 0,
        classified: 0,
        classificationFailed: 0,
        durationMs: Date.now() - startedAt,
      });
      return { skipped: true, reason: "no_queries" };
    }

    await embedPlaygroundQueries({
      campaignId: run.campaignId,
      queries: run.queries,
      runId: run.id,
      userId: run.userId,
    });

    const candidatePosts = await countCandidatePosts({
      fetchedFrom: run.fetchedFrom,
      fetchedTo: run.fetchedTo,
      subreddits,
    });
    const matches = await findBestMatches({
      fetchedFrom: run.fetchedFrom,
      fetchedTo: run.fetchedTo,
      runId: run.id,
      subreddits,
      threshold: normalizeThreshold(run.threshold),
    });

    await upsertPlaygroundResults(run.id, matches);
    await updateRunStats(run.id, {
      ...scopeStats,
      totalQueries: run.queries.length,
      candidatePosts,
      semanticMatches: matches.length,
      classified: 0,
      classificationFailed: 0,
    });

    const pendingResults = await prisma.campaignSemanticPlaygroundResult.findMany({
      where: {
        runId: run.id,
        classificationStatus: "PENDING",
      },
      orderBy: {
        bestScore: "desc",
      },
      select: {
        id: true,
        bestScore: true,
        redditItem: {
          select: {
            type: true,
            subreddit: true,
            title: true,
            description: true,
            body: true,
            author: true,
            url: true,
          },
        },
      },
    });

    let classified = 0;
    let classificationFailed = 0;

    for (const result of pendingResults) {
      try {
        const classification = await classifyLeadWithOpenAI({
          campaign: {
            name: run.campaign.name,
            leadType: run.campaign.leadType,
            description: run.campaign.description,
            keywords: run.campaign.keywords,
            negativeKeywords: run.campaign.negativeKeywords,
            subreddits: run.campaign.subreddits,
          },
          campaignId: run.campaignId,
          redditItem: {
            type: result.redditItem.type,
            subreddit: result.redditItem.subreddit,
            title: result.redditItem.title,
            description: result.redditItem.description,
            body: result.redditItem.body,
            author: result.redditItem.author,
            url: result.redditItem.url,
          },
          usageMetadata: {
            playgroundRunId: run.id,
            semanticScore: result.bestScore,
          },
          usageOperation: "playground_lead_classification",
          userId: run.userId,
        });

        await prisma.campaignSemanticPlaygroundResult.update({
          where: {
            id: result.id,
          },
          data: {
            buyerStage: mapBuyerStage(classification.buyerStage),
            category: classification.category,
            classifiedAt: new Date(),
            classificationStatus: "CLASSIFIED",
            disqualifier: classification.disqualifier,
            error: null,
            intentType: mapIntentType(classification.intentType),
            label: classification.label,
            model: classification.model,
            painPoints: classification.painPoints,
            promptVersion: classification.promptVersion,
            score: classification.score,
            summary: classification.summary,
          },
        });

        classified += 1;
      } catch (error) {
        classificationFailed += 1;
        await prisma.campaignSemanticPlaygroundResult.update({
          where: {
            id: result.id,
          },
          data: {
            classificationStatus: "FAILED",
            error: getErrorMessage(error),
          },
        });

        workerLogger.warn(
          {
            error,
            jobId,
            resultId: result.id,
            runId: run.id,
          },
          "Semantic playground item classification failed",
        );
      }

      await updateRunStats(run.id, {
        ...scopeStats,
        totalQueries: run.queries.length,
        candidatePosts,
        semanticMatches: matches.length,
        classified,
        classificationFailed,
      });
    }

    const durationMs = Date.now() - startedAt;

    await markRunCompleted(run.id, "Semantic playground run completed.", {
      ...scopeStats,
      totalQueries: run.queries.length,
      candidatePosts,
      semanticMatches: matches.length,
      classified,
      classificationFailed,
      durationMs,
    });

    workerLogger.info(
      {
        candidatePosts,
        classified,
        classificationFailed,
        durationMs,
        jobId,
        runId: run.id,
        ...scopeStats,
        semanticMatches: matches.length,
        threshold: run.threshold,
      },
      "Semantic playground run completed",
    );

    return {
      candidatePosts,
      classified,
      classificationFailed,
      durationMs,
      runId: run.id,
      ...scopeStats,
      semanticMatches: matches.length,
    };
  } catch (error) {
    await prisma.campaignSemanticPlaygroundRun.updateMany({
      where: {
        id: data.runId,
      },
      data: {
        error: getErrorMessage(error),
        failedAt: new Date(),
        status: "FAILED",
      },
    });

    throw error;
  }
}

async function embedPlaygroundQueries({
  campaignId,
  queries,
  runId,
  userId,
}: {
  campaignId: string;
  queries: PlaygroundQueryRow[];
  runId: string;
  userId: string;
}) {
  for (const chunk of chunkQueries(queries)) {
    const result = await generateEmbeddings({
      input: chunk.map((query) => query.queryText),
      model: "text-embedding-3-small",
      dimensions: 1536,
      usage: {
        userId,
        campaignId,
        operation: "playground_semantic_query_embedding",
        metadata: {
          itemCount: chunk.length,
          playgroundRunId: runId,
        },
      },
    });

    for (let index = 0; index < chunk.length; index += 1) {
      const query = chunk[index];
      const vectorLiteral = `[${result.embeddings[index].join(",")}]`;

      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "CampaignSemanticPlaygroundQuery"
          SET
            "dimensions" = ${result.dimensions},
            "embedding" = CAST(${vectorLiteral} AS vector),
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${query.id}
        `,
      );
    }
  }
}

async function countCandidatePosts({
  fetchedFrom,
  fetchedTo,
  subreddits,
}: {
  fetchedFrom: Date;
  fetchedTo: Date;
  subreddits: string[];
}) {
  const [row] = await prisma.$queryRaw<Array<{ count: bigint | number }>>(
    Prisma.sql`
      SELECT COUNT(*) AS "count"
      FROM "RedditItem" "ri"
      JOIN "RedditItemEmbedding" "rie"
        ON "rie"."redditItemId" = "ri"."id"
      WHERE "ri"."type" = 'POST'
        AND "ri"."subreddit" IN (${Prisma.join(subreddits)})
        AND "ri"."fetchedAt" >= ${fetchedFrom}
        AND "ri"."fetchedAt" < ${fetchedTo}
        AND "rie"."embedding" IS NOT NULL
    `,
  );

  return Number(row?.count ?? 0);
}

async function findBestMatches({
  fetchedFrom,
  fetchedTo,
  runId,
  subreddits,
  threshold,
}: {
  fetchedFrom: Date;
  fetchedTo: Date;
  runId: string;
  subreddits: string[];
  threshold: number;
}) {
  if (subreddits.length === 0) {
    return [];
  }

  return prisma.$queryRaw<MatchRow[]>(
    Prisma.sql`
      WITH "queryMatches" AS (
        SELECT
          "ri"."id" AS "redditItemId",
          "q"."id" AS "queryId",
          "q"."queryText" AS "queryText",
          1 - ("rie"."embedding" <=> "q"."embedding") AS "similarity"
        FROM "CampaignSemanticPlaygroundQuery" "q"
        JOIN "RedditItemEmbedding" "rie"
          ON "rie"."embedding" IS NOT NULL
        JOIN "RedditItem" "ri"
          ON "ri"."id" = "rie"."redditItemId"
        WHERE "q"."runId" = ${runId}
          AND "q"."embedding" IS NOT NULL
          AND "ri"."type" = 'POST'
          AND "ri"."subreddit" IN (${Prisma.join(subreddits)})
          AND "ri"."fetchedAt" >= ${fetchedFrom}
          AND "ri"."fetchedAt" < ${fetchedTo}
          AND 1 - ("rie"."embedding" <=> "q"."embedding") >= ${threshold}
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

async function upsertPlaygroundResults(runId: string, matches: MatchRow[]) {
  if (matches.length === 0) {
    return;
  }

  for (const match of matches) {
    await prisma.campaignSemanticPlaygroundResult.upsert({
      where: {
        runId_redditItemId: {
          redditItemId: match.redditItemId,
          runId,
        },
      },
      update: {
        bestQueryId: match.queryId,
        bestQueryText: match.queryText,
        bestScore: match.similarity,
      },
      create: {
        bestQueryId: match.queryId,
        bestQueryText: match.queryText,
        bestScore: match.similarity,
        redditItemId: match.redditItemId,
        runId,
      },
    });
  }
}

async function markRunProcessing(runId: string, stats: Record<string, unknown>) {
  await prisma.campaignSemanticPlaygroundRun.update({
    where: {
      id: runId,
    },
    data: {
      error: null,
      startedAt: new Date(),
      statsJson: stats as Prisma.InputJsonValue,
      status: "PROCESSING",
    },
  });
}

async function updateRunStats(runId: string, stats: Record<string, unknown>) {
  await prisma.campaignSemanticPlaygroundRun.update({
    where: {
      id: runId,
    },
    data: {
      statsJson: stats as Prisma.InputJsonValue,
    },
  });
}

async function markRunCompleted(runId: string, message: string, stats: Record<string, unknown>) {
  await prisma.campaignSemanticPlaygroundRun.update({
    where: {
      id: runId,
    },
    data: {
      completedAt: new Date(),
      error: null,
      statsJson: {
        ...stats,
        message,
      } as Prisma.InputJsonValue,
      status: "COMPLETED",
    },
  });
}

function chunkQueries(queries: PlaygroundQueryRow[]) {
  const chunks: PlaygroundQueryRow[][] = [];
  let currentChunk: PlaygroundQueryRow[] = [];
  let currentChars = 0;

  for (const query of queries) {
    const nextChars = currentChars + query.queryText.length;
    const shouldStartNextChunk =
      currentChunk.length >= workerEmbeddingBatchSize
      || (currentChunk.length > 0 && nextChars > workerEmbeddingBatchMaxChars);

    if (shouldStartNextChunk) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }

    currentChunk.push(query);
    currentChars += query.queryText.length;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}


function normalizeThreshold(value: number) {
  if (!Number.isFinite(value)) {
    return semanticMatchThreshold;
  }

  return Math.min(1, Math.max(0, value));
}

function mapIntentType(value: "none" | "implicit" | "explicit" | "switching") {
  if (value === "none") return "NONE";
  if (value === "implicit") return "IMPLICIT";
  if (value === "explicit") return "EXPLICIT";
  return "SWITCHING";
}

function mapBuyerStage(value: "solved" | "problem_aware" | "solution_aware" | "evaluating") {
  if (value === "solved") return "SOLVED";
  if (value === "problem_aware") return "PROBLEM_AWARE";
  if (value === "solution_aware") return "SOLUTION_AWARE";
  return "EVALUATING";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Semantic playground run failed.";
}
