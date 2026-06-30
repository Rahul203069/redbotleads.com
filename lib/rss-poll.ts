import { prisma } from "@/lib/prisma";
import { getDisabledDailyRssSubredditSet } from "@/lib/subreddit-polling-settings";
import { enqueueCampaignRssPollRunMatch, enqueueSubredditRssPoll } from "@/worker/queues";

export const RSS_POLL_INTERVAL_MS = 30 * 60 * 1000;
const DEFAULT_RSS_POLL_BATCH_SIZE = 100;
const CAMPAIGN_MATCHER_DELAY_MS = RSS_POLL_INTERVAL_MS + 2 * 60 * 1000;

export async function enqueueDueSubredditRssPolls(options?: {
  now?: Date;
  batchSize?: number;
}) {
  const now = options?.now ?? new Date();
  const batchSize = options?.batchSize ?? DEFAULT_RSS_POLL_BATCH_SIZE;

  const campaigns = await prisma.campaign.findMany({
    where: {
      isActive: true,
      subreddits: {
        isEmpty: false,
      },
    },
    select: {
      id: true,
      subreddits: true,
    },
  });

  const allSubreddits = Array.from(
    new Set(campaigns.flatMap((campaign) => campaign.subreddits.map(normalizeSubredditName)).filter(Boolean)),
  ).sort();
  const disabledSubreddits = await getDisabledDailyRssSubredditSet(allSubreddits);
  const subreddits = allSubreddits.filter((subreddit) => !disabledSubreddits.has(subreddit));
  const disabledSkipped = allSubreddits.length - subreddits.length;

  if (subreddits.length === 0) {
    return {
      queued: 0,
      skipped: disabledSkipped,
      failed: 0,
      subreddits: [] as string[],
      failures: [] as Array<{ subreddit: string; message: string }>,
    };
  }

  const cursors = await prisma.ingestCursor.findMany({
    where: {
      subreddit: {
        in: subreddits,
      },
    },
    select: {
      subreddit: true,
      backoffUntil: true,
    },
  });
  const cursorBySubreddit = new Map(cursors.map((cursor) => [normalizeSubredditName(cursor.subreddit), cursor]));

  const dueSubreddits = subreddits
    .filter((subreddit) => {
      const backoffUntil = cursorBySubreddit.get(subreddit)?.backoffUntil;
      return !backoffUntil || backoffUntil.getTime() <= now.getTime();
    })
    .slice(0, batchSize);

  if (dueSubreddits.length === 0) {
    return {
      queued: 0,
      skipped: subreddits.length + disabledSkipped,
      failed: 0,
      subreddits: [] as string[],
      failures: [] as Array<{ subreddit: string; message: string }>,
    };
  }

  const pollResults = await Promise.allSettled(
    dueSubreddits.map((subreddit, index) =>
      enqueueSubredditRssPoll(
        {
          subreddit,
          trigger: "rss_poll",
        },
        {
          delayMs: getStaggerDelayMs(index, dueSubreddits.length),
        },
      ),
    ),
  );

  const queuedSubreddits: string[] = [];
  const failures: Array<{ subreddit: string; message: string }> = [];

  pollResults.forEach((result, index) => {
    const subreddit = dueSubreddits[index];

    if (!subreddit) {
      return;
    }

    if (result.status === "fulfilled") {
      queuedSubreddits.push(subreddit);
      return;
    }

    failures.push({
      subreddit,
      message: result.reason instanceof Error ? result.reason.message : "RSS poll enqueue failed.",
    });
  });

  const queuedSubredditSet = new Set(queuedSubreddits);
  const matcherResults = await Promise.allSettled(
    campaigns
      .map((campaign) => ({
        id: campaign.id,
        subreddits: Array.from(new Set(campaign.subreddits.map(normalizeSubredditName).filter(Boolean)))
          .filter((subreddit) => !disabledSubreddits.has(subreddit))
          .sort(),
      }))
      .filter((campaign) => campaign.subreddits.length > 0)
      .filter((campaign) => campaign.subreddits.every((subreddit) => queuedSubredditSet.has(subreddit)))
      .map((campaign) =>
        enqueueCampaignRssPollRunMatch(
          {
            campaignId: campaign.id,
            runStartedAt: now.toISOString(),
            expectedSubreddits: campaign.subreddits,
          },
          {
            delayMs: CAMPAIGN_MATCHER_DELAY_MS,
          },
        ),
      ),
  );

  const matcherFailures = matcherResults.filter((result) => result.status === "rejected").length;

  return {
    queued: queuedSubreddits.length,
    skipped: subreddits.length - dueSubreddits.length + disabledSkipped,
    failed: failures.length + matcherFailures,
    campaignMatchersQueued: matcherResults.length - matcherFailures,
    subreddits: queuedSubreddits,
    failures,
  };
}

function getStaggerDelayMs(index: number, total: number) {
  if (total <= 1) {
    return 0;
  }

  return Math.floor((RSS_POLL_INTERVAL_MS / total) * index);
}

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}
