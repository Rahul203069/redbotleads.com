import { prisma } from "@/lib/prisma";

export type DailySubredditDateRange = {
  from: Date;
  to: Date;
  source: "query" | "server";
};

export type DailySubredditAnalyticsRow = {
  subreddit: string;
  uniquePostsFetched: number;
  embeddingsCompleted: number;
  embeddingsQueued: number;
  rssRequests: number;
  errorsAndRateLimits: number;
  latestFetchedAt: Date | null;
  latestEmbeddingAt: Date | null;
};

export type DailySubredditAnalytics = Awaited<ReturnType<typeof getDailySubredditAnalytics>>;

export function getDailySubredditDateRange(input: {
  from?: string;
  to?: string;
}): DailySubredditDateRange {
  const from = input.from ? new Date(input.from) : null;
  const to = input.to ? new Date(input.to) : null;

  if (from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to) {
    return {
      from,
      to,
      source: "query",
    };
  }

  const now = new Date();
  const fallbackFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fallbackTo = new Date(fallbackFrom.getFullYear(), fallbackFrom.getMonth(), fallbackFrom.getDate() + 1);

  return {
    from: fallbackFrom,
    to: fallbackTo,
    source: "server",
  };
}

export async function getDailySubredditAnalytics({
  from,
  to,
}: {
  from: Date;
  to: Date;
}) {
  const [fetchedPostGroups, completedEmbeddings, rssEvents] = await Promise.all([
    prisma.redditItem.groupBy({
      by: ["subreddit"],
      where: {
        type: "POST",
        fetchedAt: {
          gte: from,
          lt: to,
        },
      },
      _count: {
        _all: true,
      },
      _max: {
        fetchedAt: true,
      },
    }),
    prisma.redditItemEmbedding.findMany({
      where: {
        createdAt: {
          gte: from,
          lt: to,
        },
        redditItem: {
          type: "POST",
        },
      },
      select: {
        createdAt: true,
        redditItem: {
          select: {
            subreddit: true,
          },
        },
      },
    }),
    prisma.subredditRssPollEvent.findMany({
      where: {
        requestedAt: {
          gte: from,
          lt: to,
        },
      },
      select: {
        subreddit: true,
        status: true,
        requestedAt: true,
        queuedEmbeddings: true,
      },
    }),
  ]);

  const rowsBySubreddit = new Map<string, DailySubredditAnalyticsRow>();

  for (const group of fetchedPostGroups) {
    const subreddit = normalizeSubredditName(group.subreddit);
    const row = getOrCreateRow(rowsBySubreddit, subreddit);

    row.uniquePostsFetched = group._count._all;
    row.latestFetchedAt = group._max.fetchedAt ?? null;
  }

  for (const embedding of completedEmbeddings) {
    const subreddit = normalizeSubredditName(embedding.redditItem.subreddit);
    const row = getOrCreateRow(rowsBySubreddit, subreddit);

    row.embeddingsCompleted += 1;
    row.latestEmbeddingAt = maxDate(row.latestEmbeddingAt, embedding.createdAt);
  }

  for (const event of rssEvents) {
    const subreddit = normalizeSubredditName(event.subreddit);
    const row = getOrCreateRow(rowsBySubreddit, subreddit);

    if (event.status !== "BACKOFF_SKIPPED") {
      row.rssRequests += 1;
    }

    if (event.status === "RATE_LIMIT_RETRYING" || event.status === "RATE_LIMITED" || event.status === "HTTP_ERROR" || event.status === "NETWORK_ERROR" || event.status === "NOT_FOUND") {
      row.errorsAndRateLimits += 1;
    }

    row.embeddingsQueued += event.queuedEmbeddings ?? 0;
  }

  const rows = Array.from(rowsBySubreddit.values()).sort((left, right) => {
    const postDelta = right.uniquePostsFetched - left.uniquePostsFetched;

    if (postDelta !== 0) {
      return postDelta;
    }

    const embeddingDelta = right.embeddingsCompleted - left.embeddingsCompleted;

    if (embeddingDelta !== 0) {
      return embeddingDelta;
    }

    return left.subreddit.localeCompare(right.subreddit);
  });

  return {
    metrics: {
      subreddits: rows.length,
      uniquePostsFetched: sumBy(rows, (row) => row.uniquePostsFetched),
      embeddingsCompleted: sumBy(rows, (row) => row.embeddingsCompleted),
      embeddingsQueued: sumBy(rows, (row) => row.embeddingsQueued),
      rssRequests: sumBy(rows, (row) => row.rssRequests),
      errorsAndRateLimits: sumBy(rows, (row) => row.errorsAndRateLimits),
    },
    rows,
  };
}

function getOrCreateRow(rowsBySubreddit: Map<string, DailySubredditAnalyticsRow>, subreddit: string) {
  const existing = rowsBySubreddit.get(subreddit);

  if (existing) {
    return existing;
  }

  const row: DailySubredditAnalyticsRow = {
    subreddit,
    uniquePostsFetched: 0,
    embeddingsCompleted: 0,
    embeddingsQueued: 0,
    rssRequests: 0,
    errorsAndRateLimits: 0,
    latestFetchedAt: null,
    latestEmbeddingAt: null,
  };

  rowsBySubreddit.set(subreddit, row);
  return row;
}

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function maxDate(left: Date | null, right: Date) {
  return !left || right.getTime() > left.getTime() ? right : left;
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((sum, item) => sum + selector(item), 0);
}
