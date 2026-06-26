import "dotenv/config";

import { randomUUID } from "node:crypto";
import Redis from "ioredis";

import { prisma } from "@/lib/prisma";

import {
  subredditDailySchedulerBaseDelayMs,
  subredditDailySchedulerEmptySleepMs,
  subredditDailySchedulerJitterMs,
  subredditDailySchedulerLockTtlMs,
  workerRedisConnection,
} from "./config";
import { workerLogger } from "./logger";
import { enqueueSubredditDailyIngest } from "./queues";

const schedulerLockKey = "redbot:subreddit-daily-scheduler:lock";
const schedulerId = randomUUID();
const schedulerRedis = new Redis(workerRedisConnection.url, {
  maxRetriesPerRequest: null,
});

void startSubredditDailyScheduler();

async function startSubredditDailyScheduler() {
  const lockAcquired = await acquireSchedulerLock();

  if (!lockAcquired) {
    workerLogger.info("Subreddit daily scheduler is already active in another worker process");
    return;
  }

  const renewalInterval = setInterval(() => {
    void renewSchedulerLock().catch((error) => {
      workerLogger.error({ error }, "Subreddit daily scheduler lock renewal failed");
    });
  }, Math.max(1000, Math.floor(subredditDailySchedulerLockTtlMs / 2)));

  renewalInterval.unref?.();

  workerLogger.info(
    {
      schedulerId,
      baseDelayMs: subredditDailySchedulerBaseDelayMs,
      jitterMs: subredditDailySchedulerJitterMs,
      emptySleepMs: subredditDailySchedulerEmptySleepMs,
      lockTtlMs: subredditDailySchedulerLockTtlMs,
    },
    "Subreddit daily scheduler started",
  );

  try {
    await runSchedulerLoop();
  } catch (error) {
    workerLogger.error({ error }, "Subreddit daily scheduler stopped after an unrecoverable error");
  } finally {
    clearInterval(renewalInterval);
    await releaseSchedulerLock();
  }
}

async function runSchedulerLoop() {
  while (await ownsSchedulerLock()) {
    const subreddits = await loadActiveCampaignSubreddits();

    if (subreddits.length === 0) {
      workerLogger.info(
        { sleepMs: subredditDailySchedulerEmptySleepMs },
        "Subreddit daily scheduler found no active campaign subreddits",
      );
      await sleep(subredditDailySchedulerEmptySleepMs);
      continue;
    }

    for (const subreddit of subreddits) {
      if (!(await ownsSchedulerLock())) {
        workerLogger.warn({ schedulerId }, "Subreddit daily scheduler lost lock");
        return;
      }

      try {
        await enqueueSubredditDailyIngest({
          subreddit,
          trigger: "subreddit_daily_scheduler",
        });

        workerLogger.info({ subreddit }, "Subreddit daily ingestion job enqueued");
      } catch (error) {
        workerLogger.error(
          {
            subreddit,
            error,
          },
          "Subreddit daily scheduler failed to enqueue subreddit",
        );
      }

      await sleep(getNextDelayMs());
    }
  }
}

async function loadActiveCampaignSubreddits() {
  const campaigns = await prisma.campaign.findMany({
    where: {
      isActive: true,
      subreddits: {
        isEmpty: false,
      },
    },
    select: {
      subreddits: true,
    },
  });

  return Array.from(
    new Set(campaigns.flatMap((campaign) => campaign.subreddits.map(normalizeSubredditName)).filter(Boolean)),
  ).sort();
}

async function acquireSchedulerLock() {
  const result = await schedulerRedis.set(
    schedulerLockKey,
    schedulerId,
    "PX",
    subredditDailySchedulerLockTtlMs,
    "NX",
  );

  return result === "OK";
}

async function renewSchedulerLock() {
  const result = await schedulerRedis.eval(
    `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("PEXPIRE", KEYS[1], ARGV[2])
      end

      return 0
    `,
    1,
    schedulerLockKey,
    schedulerId,
    String(subredditDailySchedulerLockTtlMs),
  );

  return Number(result) === 1;
}

async function ownsSchedulerLock() {
  return await schedulerRedis.get(schedulerLockKey) === schedulerId;
}

async function releaseSchedulerLock() {
  await schedulerRedis.eval(
    `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end

      return 0
    `,
    1,
    schedulerLockKey,
    schedulerId,
  );
}

function getNextDelayMs() {
  const jitter = subredditDailySchedulerJitterMs > 0
    ? Math.floor(Math.random() * subredditDailySchedulerJitterMs)
    : 0;

  return subredditDailySchedulerBaseDelayMs + jitter;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}
