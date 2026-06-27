import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Worker } from "bullmq";

import { workerIngestionConcurrency, workerRedisConnection } from "./config";
import { workerLogger } from "./logger";
import {
  enqueueCampaignRssPollRunMatch,
  enqueueRedditItemEmbedding,
  enqueueRedditItemSemanticMatch,
  matchCampaignRssPollRunJobName,
  pollSubredditRssJobName,
  rssPollingQueueName,
  type MatchCampaignRssPollRunJobData,
  type PollSubredditRssJobData,
} from "./queues";
import { fetchSubredditPosts, RedditRssFetchError, type RedditPost } from "./reddit";
import { markCampaignRunCompleted, markCampaignRunProcessing } from "./campaign-runs";
import { createSubredditRssPollDiagnostics } from "./subreddit-rss-poll-diagnostics";

const REDDIT_RATE_LIMIT_BACKOFF_MS = 60 * 60 * 1000;
const REDDIT_TRANSIENT_BACKOFF_MS = 15 * 60 * 1000;
const CAMPAIGN_MATCH_RETRY_DELAY_MS = 2 * 60 * 1000;
const CAMPAIGN_MATCH_MAX_ATTEMPTS = 8;

type RssPollingJobData = PollSubredditRssJobData | MatchCampaignRssPollRunJobData;

const worker = new Worker<RssPollingJobData>(
  rssPollingQueueName,
  async (job) => {
    if (job.name === pollSubredditRssJobName) {
      return runSubredditRssPoll(job.data as PollSubredditRssJobData, job.id ?? "unknown");
    }

    if (job.name === matchCampaignRssPollRunJobName) {
      return runCampaignRssPollRunMatch(job.data as MatchCampaignRssPollRunJobData, job.id ?? "unknown");
    }

    workerLogger.warn({ jobId: job.id, name: job.name }, "Ignoring unsupported RSS polling job");
    return;
  },
  {
    connection: workerRedisConnection,
    concurrency: workerIngestionConcurrency,
  },
);

worker.on("completed", (job) => {
  workerLogger.info({ jobId: job.id, name: job.name }, "RSS polling job completed");
});

worker.on("failed", (job, error) => {
  workerLogger.error({ jobId: job?.id, name: job?.name, error }, "RSS polling job failed");
});

workerLogger.info("RSS polling worker started");

async function runSubredditRssPoll(data: PollSubredditRssJobData, jobId: string) {
  const subreddit = normalizeSubredditName(data.subreddit);

  if (!subreddit) {
    workerLogger.warn({ jobId, data }, "Skipping RSS poll because subreddit is missing");
    return { skipped: true, reason: "missing_subreddit" };
  }

  const cursor = await prisma.ingestCursor.findUnique({
    where: {
      subreddit,
    },
    select: {
      lastPostFullname: true,
      lastFetchedPostsAt: true,
      backoffUntil: true,
    },
  });

  const now = new Date();
  const diagnostics = createSubredditRssPollDiagnostics({
    jobId,
    source: "RSS_POLL",
    subreddit,
  });

  if (cursor?.backoffUntil && cursor.backoffUntil.getTime() > now.getTime()) {
    await diagnostics.recordBackoffSkip({
      backoffUntil: cursor.backoffUntil,
    });

    workerLogger.info(
      { jobId, subreddit, backoffUntil: cursor.backoffUntil },
      "Skipping RSS poll because subreddit is in backoff",
    );

    return {
      skipped: true,
      reason: "backoff",
      backoffUntil: cursor.backoffUntil,
    };
  }

  const startedAt = Date.now();
  let fetchedPosts = 0;
  let existingPosts = 0;
  let createdPosts = 0;
  let queuedEmbeddings = 0;

  try {
    const posts = (await fetchSubredditPosts(subreddit, {
      observer: diagnostics.observer,
    })).sort(
      (left, right) => right.createdUtc.getTime() - left.createdUtc.getTime(),
    );
    fetchedPosts = posts.length;

    const newestSeenPost = posts[0] ?? null;

    for (const post of posts) {
      if (isKnownPostBoundary(post, cursor?.lastPostFullname ?? null, cursor?.lastFetchedPostsAt ?? null)) {
        break;
      }

      const redditItem = await createRedditPostIfMissing(post);

      if (!redditItem.created) {
        existingPosts += 1;
        continue;
      }

      createdPosts += 1;
      await enqueueRedditItemEmbedding({
        redditItemId: redditItem.id,
      });
      queuedEmbeddings += 1;
    }

    if (newestSeenPost) {
      await prisma.ingestCursor.upsert({
        where: {
          subreddit,
        },
        update: {
          lastPostFullname: newestSeenPost.fullname,
          lastFetchedPostsAt: newestSeenPost.createdUtc,
          backoffUntil: null,
        },
        create: {
          subreddit,
          lastPostFullname: newestSeenPost.fullname,
          lastFetchedPostsAt: newestSeenPost.createdUtc,
        },
      });
    } else {
      await prisma.ingestCursor.upsert({
        where: {
          subreddit,
        },
        update: {
          backoffUntil: null,
        },
        create: {
          subreddit,
        },
      });
    }

    await diagnostics.recordOutcome({
      fetchedPosts,
      existingPosts,
      createdPosts,
      queuedEmbeddings,
    });

    const durationMs = Date.now() - startedAt;

    workerLogger.info(
      {
        jobId,
        subreddit,
        fetchedPosts,
        existingPosts,
        createdPosts,
        queuedEmbeddings,
        durationMs,
      },
      "Subreddit RSS polling completed",
    );

    return {
      subreddit,
      fetchedPosts,
      existingPosts,
      createdPosts,
      queuedEmbeddings,
      durationMs,
    };
  } catch (error) {
    const backoffMs = isRedditRateLimitError(error) ? REDDIT_RATE_LIMIT_BACKOFF_MS : REDDIT_TRANSIENT_BACKOFF_MS;
    const backoffUntil = new Date(Date.now() + backoffMs);

    await diagnostics.recordOutcome({
      fetchedPosts,
      existingPosts,
      createdPosts,
      queuedEmbeddings,
      backoffUntil,
    });

    await prisma.ingestCursor.upsert({
      where: {
        subreddit,
      },
      update: {
        backoffUntil,
      },
      create: {
        subreddit,
        backoffUntil,
      },
    });

    workerLogger.error(
      {
        jobId,
        subreddit,
        error: serializeError(error),
        backoffUntil,
      },
      "Subreddit RSS polling failed and backoff was applied",
    );

    throw error;
  }
}

async function runCampaignRssPollRunMatch(data: MatchCampaignRssPollRunJobData, jobId: string) {
  const runStartedAt = new Date(data.runStartedAt);
  const attempt = data.attempt ?? 0;
  const expectedSubreddits = Array.from(new Set(data.expectedSubreddits.map(normalizeSubredditName).filter(Boolean)));

  if (!data.campaignId || Number.isNaN(runStartedAt.getTime()) || expectedSubreddits.length === 0) {
    workerLogger.warn({ jobId, data }, "Skipping campaign RSS poll match because payload is invalid");
    return { skipped: true, reason: "invalid_payload" };
  }

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
    await markCampaignRunCompleted(data.campaignRunId, "Skipping RSS poll match for inactive or missing campaign.");
    workerLogger.info({ jobId, campaignId: data.campaignId }, "Skipping RSS poll match for inactive or missing campaign");
    return { skipped: true, reason: "campaign_missing_or_inactive" };
  }

  await markCampaignRunProcessing(data.campaignRunId, "Matching new RSS posts to this campaign.");

  const cursors = await prisma.ingestCursor.findMany({
    where: {
      subreddit: {
        in: expectedSubreddits,
      },
    },
    select: {
      subreddit: true,
      backoffUntil: true,
      updatedAt: true,
    },
  });
  const cursorBySubreddit = new Map(cursors.map((cursor) => [normalizeSubredditName(cursor.subreddit), cursor]));
  const missingSubreddits = expectedSubreddits.filter((subreddit) => !cursorBySubreddit.has(subreddit));
  const pendingSubreddits = expectedSubreddits.filter((subreddit) => {
    const cursor = cursorBySubreddit.get(subreddit);
    return !cursor || cursor.updatedAt.getTime() < runStartedAt.getTime();
  });
  const backedOffSubreddits = expectedSubreddits.filter((subreddit) => {
    const backoffUntil = cursorBySubreddit.get(subreddit)?.backoffUntil;
    return Boolean(backoffUntil && backoffUntil.getTime() > runStartedAt.getTime());
  });

  if (backedOffSubreddits.length > 0) {
    workerLogger.warn(
      { jobId, campaignId: campaign.id, backedOffSubreddits },
      "Skipping campaign RSS poll match because at least one subreddit is in backoff",
    );
    return { skipped: true, reason: "subreddit_backoff", backedOffSubreddits };
  }

  if ((missingSubreddits.length > 0 || pendingSubreddits.length > 0) && attempt < CAMPAIGN_MATCH_MAX_ATTEMPTS) {
    await enqueueCampaignRssPollRunMatch(
      {
        ...data,
        campaignRunId: data.campaignRunId,
        expectedSubreddits,
        attempt: attempt + 1,
      },
      {
        delayMs: CAMPAIGN_MATCH_RETRY_DELAY_MS,
      },
    );

    workerLogger.info(
      { jobId, campaignId: campaign.id, missingSubreddits, pendingSubreddits, attempt },
      "Campaign RSS poll match is waiting for subreddit polling to finish",
    );

    return { waiting: true, missingSubreddits, pendingSubreddits, attempt };
  }

  if (missingSubreddits.length > 0 || pendingSubreddits.length > 0) {
    workerLogger.warn(
      { jobId, campaignId: campaign.id, missingSubreddits, pendingSubreddits, attempt },
      "Skipping campaign RSS poll match because subreddit polling did not finish in time",
    );
    return { skipped: true, reason: "subreddit_poll_timeout", missingSubreddits, pendingSubreddits };
  }

  const [missingEmbeddingCount, candidateItems] = await Promise.all([
    prisma.redditItem.count({
      where: {
        fetchedAt: {
          gte: runStartedAt,
        },
        subreddit: {
          in: expectedSubreddits,
        },
        embedding: null,
      },
    }),
    prisma.redditItem.findMany({
      where: {
        fetchedAt: {
          gte: runStartedAt,
        },
        subreddit: {
          in: expectedSubreddits,
        },
        embedding: {
          isNot: null,
        },
        leads: {
          none: {
            campaignId: campaign.id,
          },
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        createdUtc: "desc",
      },
    }),
  ]);

  if (missingEmbeddingCount > 0 && attempt < CAMPAIGN_MATCH_MAX_ATTEMPTS) {
    await enqueueCampaignRssPollRunMatch(
      {
        ...data,
        campaignRunId: data.campaignRunId,
        expectedSubreddits,
        attempt: attempt + 1,
      },
      {
        delayMs: CAMPAIGN_MATCH_RETRY_DELAY_MS,
      },
    );

    workerLogger.info(
      { jobId, campaignId: campaign.id, missingEmbeddingCount, attempt },
      "Campaign RSS poll match is waiting for Reddit item embeddings",
    );

    return { waiting: true, reason: "embeddings_pending", missingEmbeddingCount, attempt };
  }

  await Promise.all(
    candidateItems.map((item) =>
      enqueueRedditItemSemanticMatch({
        campaignId: campaign.id,
        campaignRunId: data.campaignRunId,
        redditItemId: item.id,
        trigger: "rss_poll",
      }),
    ),
  );

  workerLogger.info(
    {
      jobId,
      campaignId: campaign.id,
      runStartedAt: runStartedAt.toISOString(),
      candidateItems: candidateItems.length,
      missingEmbeddingCount,
    },
    "Campaign RSS poll match queued semantic candidates",
  );

  await markCampaignRunCompleted(data.campaignRunId, "Campaign RSS poll match queued semantic candidates.", {
    candidateItems: candidateItems.length,
    missingEmbeddingCount,
  });

  return {
    campaignId: campaign.id,
    candidateItems: candidateItems.length,
    missingEmbeddingCount,
  };
}

async function createRedditPostIfMissing(post: RedditPost) {
  try {
    const redditItem = await prisma.redditItem.create({
      data: {
        fullname: post.fullname,
        type: "POST",
        subreddit: post.subreddit,
        title: post.title || null,
        description: post.description || null,
        body: post.body || null,
        author: post.author,
        url: post.url,
        createdUtc: post.createdUtc,
        rawJson: post.rawJson as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    });

    return {
      id: redditItem.id,
      created: true,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.redditItem.findUnique({
        where: {
          fullname: post.fullname,
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

function isKnownPostBoundary(
  post: { fullname: string; createdUtc: Date },
  lastPostFullname: string | null,
  lastFetchedPostsAt: Date | null,
) {
  if (lastPostFullname && post.fullname === lastPostFullname) {
    return true;
  }

  if (lastFetchedPostsAt && post.createdUtc.getTime() <= lastFetchedPostsAt.getTime()) {
    return true;
  }

  return false;
}

function isRedditRateLimitError(error: unknown) {
  if (error instanceof RedditRssFetchError) {
    return error.status === 429;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\b429\b/.test(message) || message.toLowerCase().includes("too many requests");
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...("status" in error && typeof error.status === "number" ? { status: error.status } : {}),
      ...("statusText" in error && typeof error.statusText === "string" ? { statusText: error.statusText } : {}),
      ...("retryAfterMs" in error && typeof error.retryAfterMs === "number" ? { retryAfterMs: error.retryAfterMs } : {}),
    };
  }

  return {
    message: String(error ?? "Unknown error"),
  };
}

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}
