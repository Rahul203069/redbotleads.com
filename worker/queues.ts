import { Queue } from "bullmq";

import { workerRedisConnection } from "./config";

export const ingestionQueueName = "ingestion";
export const classificationQueueName = "classification";
export const notificationsQueueName = "notifications";

export type IngestionJobName = "FETCH_POSTS" | "FETCH_COMMENTS" | "FETCH_THREAD_COMMENTS";
export type ClassificationJobName = "CLASSIFY_LEAD" | "GENERATE_REPLIES";
export type NotificationJobName = "SEND_EMAIL" | "SEND_SLACK";

export const ingestionQueue = new Queue(ingestionQueueName, {
  connection: workerRedisConnection,
});

export const classificationQueue = new Queue(classificationQueueName, {
  connection: workerRedisConnection,
});

export const notificationsQueue = new Queue(notificationsQueueName, {
  connection: workerRedisConnection,
});
