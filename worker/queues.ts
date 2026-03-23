import { Queue } from "bullmq";

import { markCampaignQueued } from "./campaign-sync";
import { workerRedisConnection } from "./config";

export const ingestionQueueName = "ingestion";
export const embeddingQueueName = "embedding";
export const semanticQueueName = "semantic";
export const classificationQueueName = "classification";
export const notificationsQueueName = "notifications";

export type IngestionJobName = "INITIAL_INGEST";
export type EmbeddingJobName = "EMBED_LEAD" | "EMBED_REDDIT_ITEM";
export type SemanticJobName = "SEMANTIC_MATCH_LEAD" | "SEMANTIC_MATCH_REDDIT_ITEM";
export type ClassificationJobName = "CLASSIFY_LEAD" | "GENERATE_REPLIES";
export type NotificationJobName = "SEND_EMAIL" | "SEND_SLACK";

export type InitialIngestJobData = {
  campaignId: string;
  trigger: "campaign_created" | "manual_resync";
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

function buildJobId(...parts: string[]) {
  return parts
    .map((part) => part.replace(/[:\s]+/g, "-"))
    .join("--");
}

export async function enqueueInitialIngest(data: InitialIngestJobData) {
  await markCampaignQueued(data.campaignId, "Campaign queued for first Reddit sync.");

  return ingestionQueue.add("INITIAL_INGEST", data, {
    jobId: buildJobId("initial-ingest", data.campaignId),
    removeOnComplete: 100,
    removeOnFail: 200,
  });
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
