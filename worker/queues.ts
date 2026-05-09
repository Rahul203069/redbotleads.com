import { Queue } from "bullmq";

import { markCampaignFailed, markCampaignQueued } from "./campaign-sync";
import { redisQueueTimeoutMs, workerRedisConnection } from "./config";

export const ingestionQueueName = "ingestion";
export const embeddingQueueName = "embedding";
export const semanticQueueName = "semantic";
export const classificationQueueName = "classification";
export const notificationsQueueName = "notifications";

export const initialIngestJobName = "INITIAL_INGEST";
export const dailyIngestJobName = "DAILY_INGEST";

export type IngestionJobName = typeof initialIngestJobName | typeof dailyIngestJobName;
export type EmbeddingJobName = "EMBED_LEAD" | "EMBED_REDDIT_ITEM";
export type SemanticJobName = "SEMANTIC_MATCH_LEAD" | "SEMANTIC_MATCH_REDDIT_ITEM";
export type ClassificationJobName = "CLASSIFY_LEAD" | "GENERATE_REPLIES";
export type NotificationJobName = "SEND_EMAIL" | "SEND_SLACK";

export type InitialIngestJobData = {
  campaignId: string;
  trigger: "campaign_created" | "manual_resync";
};

export type DailyIngestJobData = {
  campaignId: string;
  trigger: "daily_sync";
};

export type ClassificationJobData = {
  leadId: string;
  campaignId: string;
};

export type EmbeddingJobData =
  | {
      leadId: string;
      campaignId: string;
      redditItemId: string;
    }
  | {
      redditItemId: string;
    };

export type SemanticJobData =
  | {
      leadId: string;
      campaignId: string;
      redditItemId: string;
    }
  | {
      redditItemId: string;
    };

export type NotificationJobData = {
  notificationId: string;
  leadId: string;
  channel: "EMAIL" | "SLACK";
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

export const classificationQueue = new Queue(classificationQueueName, {
  connection: workerRedisConnection,
});

export const notificationsQueue = new Queue(notificationsQueueName, {
  connection: workerRedisConnection,
});

const LIVE_JOB_STATES = ["waiting", "active", "delayed", "prioritized"] as const;
const MAX_JOBS_TO_SCAN_PER_QUEUE = 500;

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

    let job;

    try {
      job = await withTimeout(
        ingestionQueue.add(initialIngestJobName, data, {
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

    const job = await ingestionQueue.add(dailyIngestJobName, data, {
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

export async function enqueueLeadClassification(data: ClassificationJobData) {
  return classificationQueue.add("CLASSIFY_LEAD", data, {
    jobId: buildJobId("classify", data.leadId),
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

export async function enqueueRedditItemSemanticMatch(data: Extract<SemanticJobData, { redditItemId: string }>) {
  return semanticQueue.add("SEMANTIC_MATCH_REDDIT_ITEM", data, {
    jobId: buildJobId("semantic-item", data.redditItemId),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

export async function enqueueNotification(data: NotificationJobData) {
  return notificationsQueue.add(data.channel === "EMAIL" ? "SEND_EMAIL" : "SEND_SLACK", data, {
    jobId: buildJobId("notify", data.channel.toLowerCase(), data.notificationId),
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}
