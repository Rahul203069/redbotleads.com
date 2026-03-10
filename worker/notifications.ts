import { Worker } from "bullmq";

import { workerRedisConnection } from "./config";
import { workerLogger } from "./logger";
import { notificationsQueueName } from "./queues";

const worker = new Worker(
  notificationsQueueName,
  async (job) => {
    workerLogger.info({ jobId: job.id, name: job.name, data: job.data }, "Processing notification job");
  },
  {
    connection: workerRedisConnection,
  },
);

worker.on("completed", (job) => {
  workerLogger.info({ jobId: job.id, name: job.name }, "Notification job completed");
});

worker.on("failed", (job, error) => {
  workerLogger.error({ jobId: job?.id, name: job?.name, error }, "Notification job failed");
});

workerLogger.info("Notification worker started");
