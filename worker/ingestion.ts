import { Worker } from "bullmq";

import { workerRedisConnection } from "./config";
import { workerLogger } from "./logger";
import { ingestionQueueName } from "./queues";

const worker = new Worker(
  ingestionQueueName,
  async (job) => {
    workerLogger.info({ jobId: job.id, name: job.name, data: job.data }, "Processing ingestion job");
  },
  {
    connection: workerRedisConnection,
  },
);

worker.on("completed", (job) => {
  workerLogger.info({ jobId: job.id, name: job.name }, "Ingestion job completed");
});

worker.on("failed", (job, error) => {
  workerLogger.error({ jobId: job?.id, name: job?.name, error }, "Ingestion job failed");
});

workerLogger.info("Ingestion worker started");
