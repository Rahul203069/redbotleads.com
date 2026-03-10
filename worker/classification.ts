import { Worker } from "bullmq";

import { workerRedisConnection } from "./config";
import { workerLogger } from "./logger";
import { classificationQueueName } from "./queues";

const worker = new Worker(
  classificationQueueName,
  async (job) => {
    workerLogger.info({ jobId: job.id, name: job.name, data: job.data }, "Processing classification job");
  },
  {
    connection: workerRedisConnection,
  },
);

worker.on("completed", (job) => {
  workerLogger.info({ jobId: job.id, name: job.name }, "Classification job completed");
});

worker.on("failed", (job, error) => {
  workerLogger.error({ jobId: job?.id, name: job?.name, error }, "Classification job failed");
});

workerLogger.info("Classification worker started");
