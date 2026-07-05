import { Queue } from "bullmq";

import { markCampaignFailed, markCampaignQueued } from "./campaign-sync";
import { createCampaignRun } from "./campaign-runs";
import { redisQueueTimeoutMs, workerRedisConnection } from "./config";

export const ingestionQueueName = "ingestion";
export const embeddingQueueName = "embedding";
export const semanticQueueName = "semantic";
export const dailySemanticQueueName = "daily-semantic";
export const classificationQueueName = "classification";
export const notificationsQueueName = "notifications";
export const rssPollingQueueName = "rss-polling";

export const initialIngestJobName = "INITIAL_INGEST";
export const dailyIngestJobName = "DAILY_INGEST";
export const dailySemanticCampaignJobName = "DAILY_SEMANTIC_CAMPAIGN";
export const pollSubredditRssJobName = "POLL_SUBREDDIT_RSS";
export const matchCampaignRssPollRunJobName = "MATCH_CAMPAIGN_RSS_POLL_RUN";

export type IngestionJobName = typeof initialIngestJobName | typeof dailyIngestJobName;
export type DailySemanticJobName = typeof dailySemanticCampaignJobName;
export type RssPollingJobName = typeof pollSubredditRssJobName | typeof matchCampaignRssPollRunJobName;
export type EmbeddingJobName = "EMBED_LEAD" | "EMBED_LEAD_BATCH" | "EMBED_REDDIT_ITEM";
export type SemanticJobName = "SEMANTIC_MATCH_LEAD" | "SEMANTIC_MATCH_REDDIT_ITEM";
export type ClassificationJobName = "CLASSIFY_LEAD" | "GENERATE_REPLIES";
export type NotificationJobName = "SEND_EMAIL" | "SEND_SLACK" | "SEND_TELEGRAM";

export type InitialIngestJobData = {
  campaignId: string;
  trigger: "campaign_created" | "manual_resync";
  campaignRunId?: string;
};

export type DailyIngestJobData = {
  campaignId: string;
  trigger: "daily_sync";
  campaignRunId?: string;
};

export type DailySemanticCampaignJobData = {
  campaignId: string;
  campaignRunId?: string;
  cronRunId?: string;
  queuedAt: string;
};

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

export type ClassificationJobData = {
  leadId: string;
  campaignId: string;
  campaignRunId?: string;
  trigger?: "campaign_sync" | "rss_poll" | "daily_semantic";
};

export type LeadEmbeddingBatchItem = {
  leadId: string;
  redditItemId: string;
};

export type RedditItemEmbeddingSource = "subreddit_daily_ingest" | "rss_poll";

export type EmbeddingJobData =
  | {
      leadId: string;
      campaignId: string;
      redditItemId: string;
      campaignRunId?: string;
    }
  | {
      campaignId: string;
      campaignRunId?: string;
      items: LeadEmbeddingBatchItem[];
    }
  | {
      redditItemId: string;
      source?: RedditItemEmbeddingSource;
    };

export type SemanticJobData =
  | {
      leadId: string;
      campaignId: string;
      redditItemId: string;
      campaignRunId?: string;
      trigger?: "campaign_sync";
    }
  | {
      redditItemId: string;
      campaignId?: string;
      campaignRunId?: string;
      trigger?: "rss_poll";
    };

export type NotificationJobData = {
  notificationId: string;
  leadId: string;
  channel: "EMAIL" | "SLACK" | "TELEGRAM";
};

export type InitialIngestQueueFailureCode =
  | "REDIS_UNAVAILABLE"
  | "WORKER_UNAVAILABLE"
  | "QUEUE_ADD_FAILED"
  | "QUEUE_TIMEOUT";

export const ingestionQueue = new Queue(ingestionQueueName, {
  connection: workerRedisConnection,
});

export const embeddingQueue = new Queue(embeddingQueueName, {
  connection: workerRedisConnection,
});

export const semanticQueue = new Queue(semanticQueueName, {
  connection: workerRedisConnection,
});

export const dailySemanticQueue = new Queue(dailySemanticQueueName, {
  connection: workerRedisConnection,
});

export const classificationQueue = new Queue(classificationQueueName, {
  connection: workerRedisConnection,
});

export const notificationsQueue = new Queue(notificationsQueueName, {
  connection: workerRedisConnection,
});

export const rssPollingQueue = new Queue(rssPollingQueueName, {
  connection: workerRedisConnection,
});

const LIVE_JOB_STATES = ["waiting", "active", "delayed", "prioritized"] as const;
const REMOVABLE_JOB_STATES = ["waiting", "delayed", "prioritized", "paused"] as const;
const MAX_JOBS_TO_SCAN_PER_QUEUE = 500;
const MAX_JOBS_TO_REMOVE_PER_QUEUE = 5000;

function buildJobId(...parts: string[]) {
  return parts
    .map((part) => part.replace(/[:\s]+/g, "-"))
    .join("--");
}

async function getLiveIngestionJobForCampaign(campaignId: string) {
  const jobs = await ingestionQueue.getJobs(
    [...LIVE_JOB_STATES],
    0,
    MAX_JOBS_TO_SCAN_PER_QUEUE,
    true,
  );

  return jobs.find((job) => {
    const data = job.data as Record<string, unknown> | undefined;
    return data?.campaignId === campaignId;
  });
}

async function getLiveRssPollingJobForSubreddit(subreddit: string) {
  const normalizedSubreddit = normalizeSubredditName(subreddit);
  const jobs = await rssPollingQueue.getJobs(
    [...LIVE_JOB_STATES],
    0,
    MAX_JOBS_TO_SCAN_PER_QUEUE,
    true,
  );

  return jobs.find((job) => {
    const data = job.data as Record<string, unknown> | undefined;
    return normalizeSubredditName(String(data?.subreddit ?? "")) === normalizedSubreddit;
  });
}

async function getLiveDailySemanticJobForCampaign(campaignId: string, queuedAt: string) {
  const queuedDay = queuedAt.slice(0, 10);
  const jobs = await dailySemanticQueue.getJobs(
    [...LIVE_JOB_STATES],
    0,
    MAX_JOBS_TO_SCAN_PER_QUEUE,
    true,
  );

  return jobs.find((job) => {
    const data = job.data as Record<string, unknown> | undefined;
    return job.name === dailySemanticCampaignJobName
      && data?.campaignId === campaignId
      && String(data?.queuedAt ?? "").slice(0, 10) === queuedDay;
  });
}

class InitialIngestQueueError extends Error {
  code: InitialIngestQueueFailureCode;

  constructor(code: InitialIngestQueueFailureCode, message: string) {
    super(message);
    this.code = code;
    this.name = "InitialIngestQueueError";
  }
}

function isInitialIngestQueueError(error: unknown): error is InitialIngestQueueError {
  return error instanceof InitialIngestQueueError;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string, code: InitialIngestQueueFailureCode) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new InitialIngestQueueError(code, `${label} timed out after ${ms}ms.`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export async function checkRedisHealth() {
  try {
    await withTimeout(
      ingestionQueue.waitUntilReady(),
      redisQueueTimeoutMs,
      "Redis queue readiness check",
      "QUEUE_TIMEOUT",
    );

    const client = await ingestionQueue.client;
    const redisResponse = await withTimeout(
      client.ping(),
      redisQueueTimeoutMs,
      "Redis ping",
      "QUEUE_TIMEOUT",
    );

    if (redisResponse !== "PONG") {
      throw new InitialIngestQueueError(
        "REDIS_UNAVAILABLE",
        "Redis is connected but did not return a healthy PONG response.",
      );
    }
  } catch (error) {
    if (isInitialIngestQueueError(error)) {
      throw error;
    }

    throw new InitialIngestQueueError(
      "REDIS_UNAVAILABLE",
      error instanceof Error ? error.message : "Redis is not reachable.",
    );
  }
}

export async function checkIngestionWorkerHealth() {
  try {
    const workersCount = await withTimeout(
      ingestionQueue.getWorkersCount(),
      redisQueueTimeoutMs,
      "Ingestion worker availability check",
      "QUEUE_TIMEOUT",
    );

    if (workersCount < 1) {
      throw new InitialIngestQueueError(
        "WORKER_UNAVAILABLE",
        "No live ingestion workers are connected to the queue.",
      );
    }
  } catch (error) {
    if (isInitialIngestQueueError(error)) {
      throw error;
    }

    throw new InitialIngestQueueError(
      "WORKER_UNAVAILABLE",
      error instanceof Error ? error.message : "Ingestion workers are not reachable.",
    );
  }
}

export async function ensureIngestionQueueReady() {
  await checkRedisHealth();
  await checkIngestionWorkerHealth();
}

export async function enqueueInitialIngest(data: InitialIngestJobData) {
  try {
    await ensureIngestionQueueReady();

    const existingLiveJob = await getLiveIngestionJobForCampaign(data.campaignId);

    if (existingLiveJob) {
      await markCampaignQueued(data.campaignId, "Campaign sync is already queued or running.");
      return existingLiveJob;
    }

    const campaignRun = data.campaignRunId
      ? { id: data.campaignRunId }
      : await createCampaignRun({
          campaignId: data.campaignId,
          trigger: data.trigger === "campaign_created" ? "CAMPAIGN_CREATED" : "MANUAL_RESYNC",
          message: data.trigger === "campaign_created" ? "Initial campaign sync queued." : "Manual campaign sync queued.",
        });

    const jobData = {
      ...data,
      campaignRunId: campaignRun.id,
    };

    let job;

    try {
      job = await withTimeout(
        ingestionQueue.add(initialIngestJobName, jobData, {
          removeOnComplete: 100,
          removeOnFail: 200,
        }),
        redisQueueTimeoutMs,
        "Initial ingest enqueue",
        "QUEUE_TIMEOUT",
      );
    } catch (error) {
      if (isInitialIngestQueueError(error)) {
        throw error;
      }

      throw new InitialIngestQueueError(
        "QUEUE_ADD_FAILED",
        error instanceof Error ? error.message : "The initial ingest job could not be added to the queue.",
      );
    }

    await markCampaignQueued(data.campaignId, "Campaign queued for first Reddit sync.");

    return job;
  } catch (error) {
    const message =
      error instanceof Error
        ? `Initial sync queueing failed: ${error.message}`
        : "Initial sync queueing failed before the job could be added.";

    try {
      await markCampaignFailed(data.campaignId, "FAILED", message);
    } catch (statusError) {
      console.error("Campaign sync status update failed after queue failure", statusError);
    }

    throw error;
  }
}

export function getInitialIngestQueueFailureMessage(error: unknown) {
  if (!isInitialIngestQueueError(error)) {
    return error instanceof Error ? error.message : "The initial sync queue is unavailable.";
  }

  if (error.code === "REDIS_UNAVAILABLE") {
    return "Redis server is not reachable.";
  }

  if (error.code === "WORKER_UNAVAILABLE") {
    return "The ingestion worker is not live.";
  }

  if (error.code === "QUEUE_ADD_FAILED") {
    return "The initial sync job could not be added to the queue.";
  }

  return error.message;
}

export async function enqueueDailyIngest(
  data: DailyIngestJobData,
  options?: {
    skipHealthChecks?: boolean;
  },
) {
  try {
    if (!options?.skipHealthChecks) {
      await ensureIngestionQueueReady();
    }

    const existingLiveJob = await getLiveIngestionJobForCampaign(data.campaignId);

    if (existingLiveJob) {
      await markCampaignQueued(data.campaignId, "Campaign sync is already queued or running.");
      return existingLiveJob;
    }

    const campaignRun = data.campaignRunId
      ? { id: data.campaignRunId }
      : await createCampaignRun({
          campaignId: data.campaignId,
          trigger: "DAILY_SYNC",
          message: "Daily campaign sync queued.",
        });

    const job = await ingestionQueue.add(dailyIngestJobName, {
      ...data,
      campaignRunId: campaignRun.id,
    }, {
      removeOnComplete: 100,
      removeOnFail: 200,
    });

    await markCampaignQueued(data.campaignId, "Campaign queued for daily Reddit sync.");

    return job;
  } catch (error) {
    const message =
      error instanceof Error
        ? `Daily sync queueing failed: ${error.message}`
        : "Daily sync queueing failed before the job could be added.";

    try {
      await markCampaignFailed(data.campaignId, "FAILED", message);
    } catch (statusError) {
      console.error("Campaign sync status update failed after daily queue failure", statusError);
    }

    throw error;
  }
}

export async function enqueueDailySemanticCampaign(data: DailySemanticCampaignJobData) {
  if (!data.campaignId) {
    throw new Error("Campaign id is required for daily semantic search.");
  }

  const queuedAt = new Date(data.queuedAt);

  if (Number.isNaN(queuedAt.getTime())) {
    throw new Error("A valid queuedAt timestamp is required for daily semantic search.");
  }

  const existingLiveJob = await getLiveDailySemanticJobForCampaign(data.campaignId, queuedAt.toISOString());

  if (existingLiveJob) {
    return existingLiveJob;
  }

  const campaignRun = data.campaignRunId
    ? { id: data.campaignRunId }
    : await createCampaignRun({
        campaignId: data.campaignId,
        cronRunId: data.cronRunId,
        trigger: "DAILY_SEMANTIC",
        message: "Daily semantic search queued.",
      });

  return dailySemanticQueue.add(dailySemanticCampaignJobName, {
    campaignId: data.campaignId,
    campaignRunId: campaignRun.id,
    cronRunId: data.cronRunId,
    queuedAt: queuedAt.toISOString(),
  }, {
    jobId: buildJobId("daily-semantic", data.campaignId, queuedAt.toISOString().slice(0, 10)),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

export async function enqueueSubredditRssPoll(
  data: PollSubredditRssJobData,
  options?: {
    delayMs?: number;
  },
) {
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
      delay: Math.max(0, options?.delayMs ?? 0),
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

export async function enqueueLeadClassification(data: ClassificationJobData) {
  return classificationQueue.add("CLASSIFY_LEAD", data, {
    jobId: buildJobId("classify", data.trigger ?? "campaign-sync", data.leadId),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

export async function enqueueLeadEmbedding(data: Extract<EmbeddingJobData, { leadId: string }>) {
  return embeddingQueue.add("EMBED_LEAD", data, {
    jobId: buildJobId("embed-lead", data.leadId),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

export async function enqueueLeadEmbeddingBatch(data: Extract<EmbeddingJobData, { items: LeadEmbeddingBatchItem[] }>) {
  const firstItem = data.items[0];
  const lastItem = data.items[data.items.length - 1];

  return embeddingQueue.add("EMBED_LEAD_BATCH", data, {
    jobId: buildJobId(
      "embed-lead-batch",
      data.campaignId,
      firstItem?.leadId ?? "empty",
      lastItem?.leadId ?? "empty",
      String(data.items.length),
    ),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

export async function enqueueRedditItemEmbedding(data: Extract<EmbeddingJobData, { redditItemId: string }>) {
  return embeddingQueue.add("EMBED_REDDIT_ITEM", data, {
    jobId: buildJobId("embed-item", data.redditItemId),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

export async function enqueueLeadSemanticMatch(data: Extract<SemanticJobData, { leadId: string }>) {
  return semanticQueue.add("SEMANTIC_MATCH_LEAD", data, {
    jobId: buildJobId("semantic-lead", data.leadId),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

export async function enqueueLeadSemanticMatchBatch(items: Array<Extract<SemanticJobData, { leadId: string }>>) {
  if (items.length === 0) {
    return [];
  }

  return semanticQueue.addBulk(
    items.map((data) => ({
      name: "SEMANTIC_MATCH_LEAD",
      data,
      opts: {
        jobId: buildJobId("semantic-lead", data.leadId),
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    })),
  );
}

export async function enqueueRedditItemSemanticMatch(data: Extract<SemanticJobData, { redditItemId: string }>) {
  const jobIdParts = data.campaignId
    ? ["semantic-item", data.trigger ?? "reddit-item", data.campaignId, data.redditItemId]
    : ["semantic-item", data.redditItemId];

  return semanticQueue.add("SEMANTIC_MATCH_REDDIT_ITEM", data, {
    jobId: buildJobId(...jobIdParts),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

export async function enqueueNotification(data: NotificationJobData) {
  const jobName: NotificationJobName =
    data.channel === "EMAIL" ? "SEND_EMAIL" : data.channel === "SLACK" ? "SEND_SLACK" : "SEND_TELEGRAM";

  return notificationsQueue.add(jobName, data, {
    jobId: buildJobId("notify", data.channel.toLowerCase(), data.notificationId),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

export async function removePendingRssFetchJobsForSubreddit(subreddit: string) {
  const normalizedSubreddit = normalizeSubredditName(subreddit);

  if (!normalizedSubreddit) {
    return {
      removed: 0,
      failed: 0,
    };
  }

  const rssPollingResult = await removePendingJobsForSubreddit({
      jobNames: [pollSubredditRssJobName],
      queue: rssPollingQueue,
      subreddit: normalizedSubreddit,
    });

  return {
    removed: rssPollingResult.removed,
    failed: rssPollingResult.failed,
  };
}

async function removePendingJobsForSubreddit({
  jobNames,
  queue,
  subreddit,
}: {
  jobNames: string[];
  queue: Queue;
  subreddit: string;
}) {
  const jobs = await queue.getJobs(
    [...REMOVABLE_JOB_STATES],
    0,
    MAX_JOBS_TO_REMOVE_PER_QUEUE,
    true,
  );
  let removed = 0;
  let failed = 0;

  for (const job of jobs) {
    const data = job.data as Record<string, unknown> | undefined;

    if (!jobNames.includes(job.name) || normalizeSubredditName(String(data?.subreddit ?? "")) !== subreddit) {
      continue;
    }

    try {
      await job.remove();
      removed += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    removed,
    failed,
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
