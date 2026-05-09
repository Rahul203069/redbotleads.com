import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1, "REDIS_URL is required for worker processes."),
  REDDIT_RSS_USER_AGENT: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).optional(),
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().optional(),
  REDIS_QUEUE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  WORKER_INGESTION_CONCURRENCY: z.coerce.number().int().positive().optional(),
  WORKER_EMBEDDING_CONCURRENCY: z.coerce.number().int().positive().optional(),
  WORKER_SEMANTIC_CONCURRENCY: z.coerce.number().int().positive().optional(),
  WORKER_CLASSIFICATION_CONCURRENCY: z.coerce.number().int().positive().optional(),
  WORKER_NOTIFICATIONS_CONCURRENCY: z.coerce.number().int().positive().optional(),
});

export const workerEnv = envSchema.parse(process.env);

export const workerRedisConnection = {
  url: workerEnv.REDIS_URL,
  maxRetriesPerRequest: null,
};

export const redisQueueTimeoutMs = workerEnv.REDIS_QUEUE_TIMEOUT_MS ?? 30000;
export const workerIngestionConcurrency = workerEnv.WORKER_INGESTION_CONCURRENCY ?? 1;
export const workerEmbeddingConcurrency = workerEnv.WORKER_EMBEDDING_CONCURRENCY ?? 3;
export const workerSemanticConcurrency = workerEnv.WORKER_SEMANTIC_CONCURRENCY ?? 3;
export const workerClassificationConcurrency = workerEnv.WORKER_CLASSIFICATION_CONCURRENCY ?? 2;
export const workerNotificationsConcurrency = workerEnv.WORKER_NOTIFICATIONS_CONCURRENCY ?? 1;
