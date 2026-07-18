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
  OPENAI_EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().optional(),
  OPENAI_EMBEDDING_BATCH_MAX_CHARS: z.coerce.number().int().positive().optional(),
  OPENAI_CLASSIFICATION_MIN_INTERVAL_MS: z.coerce.number().int().nonnegative().optional(),
  SEMANTIC_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).optional(),
  REDDIT_RSS_REQUEST_INTERVAL_MS: z.coerce.number().int().nonnegative().optional(),
  REDDIT_RSS_REQUEST_JITTER_MS: z.coerce.number().int().nonnegative().optional(),
  REDDIT_RSS_MAX_RETRIES: z.coerce.number().int().nonnegative().optional(),
  REDDIT_RSS_RETRY_BACKOFF_MS: z.coerce.number().int().nonnegative().optional(),
  REDIS_QUEUE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  WORKER_INGESTION_CONCURRENCY: z.coerce.number().int().positive().optional(),
  WORKER_EMBEDDING_CONCURRENCY: z.coerce.number().int().positive().optional(),
  WORKER_SEMANTIC_CONCURRENCY: z.coerce.number().int().positive().optional(),
  WORKER_CLASSIFICATION_CONCURRENCY: z.coerce.number().int().positive().optional(),
  WORKER_NOTIFICATIONS_CONCURRENCY: z.coerce.number().int().positive().optional(),
  SUBREDDIT_DAILY_SCHEDULER_BASE_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
  SUBREDDIT_DAILY_SCHEDULER_JITTER_MS: z.coerce.number().int().nonnegative().optional(),
  SUBREDDIT_DAILY_SCHEDULER_BATCH_SIZE: z.coerce.number().int().positive().optional(),
  SUBREDDIT_DAILY_SCHEDULER_BATCH_SLEEP_MS: z.coerce.number().int().nonnegative().optional(),
  SUBREDDIT_DAILY_SCHEDULER_EMPTY_SLEEP_MS: z.coerce.number().int().positive().optional(),
  SUBREDDIT_DAILY_SCHEDULER_LOCK_TTL_MS: z.coerce.number().int().positive().optional(),
  RSS_POLL_REFILL_LOW_WATERMARK: z.coerce.number().int().nonnegative().optional(),
  RSS_POLL_REFILL_HIGH_WATERMARK: z.coerce.number().int().positive().optional(),
  RSS_POLL_REFILL_INTERVAL_MS: z.coerce.number().int().positive().optional(),
  RSS_POLL_REFILL_LOCK_TTL_MS: z.coerce.number().int().positive().optional(),
  DAILY_SEMANTIC_INITIAL_LOOKBACK_HOURS: z.coerce.number().int().positive().optional(),
  DAILY_SEMANTIC_LOOKBACK_HOURS: z.coerce.number().int().positive().optional(),
  DAILY_SEMANTIC_CANDIDATE_BATCH_SIZE: z.coerce.number().int().positive().optional(),
  DAILY_SEMANTIC_TOP_K_PER_QUERY: z.coerce.number().int().positive().optional(),
  DAILY_SEMANTIC_MAX_CAMPAIGNS_PER_CRON: z.coerce.number().int().positive().optional(),
  TELEGRAM_NOTIFICATION_INTERVAL_MS: z.coerce.number().int().nonnegative().optional(),
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
export const workerClassificationConcurrency = workerEnv.WORKER_CLASSIFICATION_CONCURRENCY ?? 10;
export const workerNotificationsConcurrency = workerEnv.WORKER_NOTIFICATIONS_CONCURRENCY ?? 1;
export const workerEmbeddingBatchSize = workerEnv.OPENAI_EMBEDDING_BATCH_SIZE ?? 64;
export const workerEmbeddingBatchMaxChars = workerEnv.OPENAI_EMBEDDING_BATCH_MAX_CHARS ?? 200000;
export const workerClassificationMinIntervalMs = workerEnv.OPENAI_CLASSIFICATION_MIN_INTERVAL_MS ?? 0;
export const semanticMatchThreshold = workerEnv.SEMANTIC_MATCH_THRESHOLD ?? 0.5;
export const redditRssRequestIntervalMs = workerEnv.REDDIT_RSS_REQUEST_INTERVAL_MS ?? 30000;
export const redditRssRequestJitterMs = workerEnv.REDDIT_RSS_REQUEST_JITTER_MS ?? 30000;
export const redditRssMaxRetries = workerEnv.REDDIT_RSS_MAX_RETRIES ?? 1;
export const redditRssRetryBackoffMs = workerEnv.REDDIT_RSS_RETRY_BACKOFF_MS ?? 180000;
export const subredditDailySchedulerBaseDelayMs = workerEnv.SUBREDDIT_DAILY_SCHEDULER_BASE_DELAY_MS ?? 70000;
export const subredditDailySchedulerJitterMs = workerEnv.SUBREDDIT_DAILY_SCHEDULER_JITTER_MS ?? 30000;
export const subredditDailySchedulerBatchSize = workerEnv.SUBREDDIT_DAILY_SCHEDULER_BATCH_SIZE ?? 30;
export const subredditDailySchedulerBatchSleepMs = workerEnv.SUBREDDIT_DAILY_SCHEDULER_BATCH_SLEEP_MS ?? 300000;
export const subredditDailySchedulerEmptySleepMs = workerEnv.SUBREDDIT_DAILY_SCHEDULER_EMPTY_SLEEP_MS ?? 300000;
export const subredditDailySchedulerLockTtlMs = workerEnv.SUBREDDIT_DAILY_SCHEDULER_LOCK_TTL_MS ?? 120000;
export const rssPollRefillLowWatermark = workerEnv.RSS_POLL_REFILL_LOW_WATERMARK ?? 10;
export const rssPollRefillHighWatermark = workerEnv.RSS_POLL_REFILL_HIGH_WATERMARK ?? 100;
export const rssPollRefillIntervalMs = workerEnv.RSS_POLL_REFILL_INTERVAL_MS ?? 30000;
export const rssPollRefillLockTtlMs = workerEnv.RSS_POLL_REFILL_LOCK_TTL_MS ?? 60000;
export const dailySemanticInitialLookbackHours = workerEnv.DAILY_SEMANTIC_INITIAL_LOOKBACK_HOURS ?? 36;
export const dailySemanticLookbackHours = workerEnv.DAILY_SEMANTIC_LOOKBACK_HOURS ?? 36;
export const dailySemanticCandidateBatchSize = workerEnv.DAILY_SEMANTIC_CANDIDATE_BATCH_SIZE ?? 1000;
export const dailySemanticTopKPerQuery = workerEnv.DAILY_SEMANTIC_TOP_K_PER_QUERY ?? 1000;
export const dailySemanticMaxCampaignsPerCron = workerEnv.DAILY_SEMANTIC_MAX_CAMPAIGNS_PER_CRON ?? 500;
export const telegramNotificationIntervalMs = workerEnv.TELEGRAM_NOTIFICATION_INTERVAL_MS ?? 2000;
