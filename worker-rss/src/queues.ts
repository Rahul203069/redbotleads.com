import { Queue } from "bullmq";

import { createCampaignRun } from "./campaign-runs";
import { workerRedisConnection } from "./config";

export const embeddingQueueName = "embedding";
export const semanticQueueName = "semantic";
export const rssPollingQueueName = "rss-polling";

export const pollSubredditRssJobName = "POLL_SUBREDDIT_RSS";
export const matchCampaignRssPollRunJobName = "MATCH_CAMPAIGN_RSS_POLL_RUN";

export type PollSubredditRssJobData = {
  subreddit: string;
  trigger: "rss_poll";
};

export type MatchCampaignRssPollRunJobData = {
  campaignId: string;
  campaignRunId?: string;
  runStartedAt: string;
  expectedSubreddits: string[];
  attempt?: number;
};

export type RedditItemEmbeddingSource = "subreddit_daily_ingest" | "rss_poll";

export type EmbeddingJobData = {
  redditItemId: string;
  source?: RedditItemEmbeddingSource;
};

export type SemanticJobData = {
  redditItemId: string;
  campaignId?: string;
  campaignRunId?: string;
  trigger?: "rss_poll";
};

export const embeddingQueue = new Queue(embeddingQueueName, {
  connection: workerRedisConnection,
});

export const semanticQueue = new Queue(semanticQueueName, {
  connection: workerRedisConnection,
});

export const rssPollingQueue = new Queue(rssPollingQueueName, {
  connection: workerRedisConnection,
});

const liveJobStates = ["waiting", "active", "delayed", "prioritized"] as const;
const maxJobsToScanPerQueue = 5000;

function buildJobId(...parts: string[]) {
  return parts
    .map((part) => part.replace(/[:\s]+/g, "-"))
    .join("--");
}

async function getLiveRssPollingJobForSubreddit(subreddit: string) {
  const normalizedSubreddit = normalizeSubredditName(subreddit);
  const jobs = await rssPollingQueue.getJobs(
    [...liveJobStates],
    0,
    maxJobsToScanPerQueue,
    true,
  );

  return jobs.find((job) => {
    const data = job.data as Record<string, unknown> | undefined;
    return job.name === pollSubredditRssJobName
      && normalizeSubredditName(String(data?.subreddit ?? "")) === normalizedSubreddit;
  });
}

export async function enqueueSubredditRssPoll(data: PollSubredditRssJobData) {
  const subreddit = normalizeSubredditName(data.subreddit);

  if (!subreddit) {
    throw new Error("Subreddit is required for RSS polling.");
  }

  const existingLiveJob = await getLiveRssPollingJobForSubreddit(subreddit);

  if (existingLiveJob) {
    return existingLiveJob;
  }

  return rssPollingQueue.add(
    pollSubredditRssJobName,
    {
      ...data,
      subreddit,
    },
    {
      removeOnComplete: 500,
      removeOnFail: 500,
    },
  );
}

export async function enqueueCampaignRssPollRunMatch(
  data: MatchCampaignRssPollRunJobData,
  options?: {
    delayMs?: number;
  },
) {
  const campaignRun = data.campaignRunId
    ? { id: data.campaignRunId }
    : await createCampaignRun({
        campaignId: data.campaignId,
        trigger: "RSS_POLL_MATCH",
        message: "Campaign RSS poll match queued.",
      });

  return rssPollingQueue.add(
    matchCampaignRssPollRunJobName,
    {
      ...data,
      campaignRunId: campaignRun.id,
      expectedSubreddits: data.expectedSubreddits.map(normalizeSubredditName).filter(Boolean),
      attempt: data.attempt ?? 0,
    },
    {
      delay: Math.max(0, options?.delayMs ?? 0),
      jobId: buildJobId("rss-run-match", data.campaignId, data.runStartedAt, String(data.attempt ?? 0)),
      removeOnComplete: 500,
      removeOnFail: 500,
    },
  );
}

export async function enqueueRedditItemEmbedding(data: EmbeddingJobData) {
  return embeddingQueue.add("EMBED_REDDIT_ITEM", data, {
    jobId: buildJobId("embed-item", data.redditItemId),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

export async function enqueueRedditItemSemanticMatch(data: SemanticJobData) {
  const jobIdParts = data.campaignId
    ? ["semantic-item", data.trigger ?? "reddit-item", data.campaignId, data.redditItemId]
    : ["semantic-item", data.redditItemId];

  return semanticQueue.add("SEMANTIC_MATCH_REDDIT_ITEM", data, {
    jobId: buildJobId(...jobIdParts),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}
