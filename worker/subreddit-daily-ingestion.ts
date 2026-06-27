import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { enqueueRedditItemEmbedding, type SubredditDailyIngestJobData } from "./queues";
import { fetchSubredditPosts, RedditRssFetchError, type RedditPost } from "./reddit";
import { workerLogger } from "./logger";
import { createSubredditRssPollDiagnostics } from "./subreddit-rss-poll-diagnostics";

const REDDIT_RATE_LIMIT_BACKOFF_MS = 60 * 60 * 1000;
const REDDIT_TRANSIENT_BACKOFF_MS = 15 * 60 * 1000;

export async function runSubredditDailyIngest(
  data: SubredditDailyIngestJobData,
  jobId: string,
  options?: {
    useRedditRequestSlot?: boolean;
  },
) {
  const subreddit = normalizeSubredditName(data.subreddit);

  if (!subreddit) {
    workerLogger.warn({ jobId, data }, "Skipping daily subreddit ingestion because subreddit is missing");
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
    source: "SUBREDDIT_DAILY_INGEST",
    subreddit,
  });

  if (cursor?.backoffUntil && cursor.backoffUntil.getTime() > now.getTime()) {
    await diagnostics.recordBackoffSkip({
      backoffUntil: cursor.backoffUntil,
    });

    workerLogger.info(
      { jobId, subreddit, backoffUntil: cursor.backoffUntil },
      "Skipping daily subreddit ingestion because subreddit is in backoff",
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
      useRequestSlot: options?.useRedditRequestSlot,
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
        source: "subreddit_daily_ingest",
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
      "Daily subreddit ingestion completed",
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
      "Daily subreddit ingestion failed and backoff was applied",
    );

    throw error;
  }
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
