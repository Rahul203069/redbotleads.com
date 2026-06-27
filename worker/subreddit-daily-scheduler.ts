import "dotenv/config";

import { randomUUID } from "node:crypto";
import Redis from "ioredis";

import { isDailyRssPollerPaused } from "@/lib/daily-rss-poller-control";
import { prisma } from "@/lib/prisma";

import {
  subredditDailySchedulerBatchSize,
  subredditDailySchedulerBatchSleepMs,
  subredditDailySchedulerBaseDelayMs,
  subredditDailySchedulerEmptySleepMs,
  subredditDailySchedulerJitterMs,
  subredditDailySchedulerLockTtlMs,
  workerRedisConnection,
} from "./config";
import { workerLogger } from "./logger";
import { runSubredditDailyIngest } from "./subreddit-daily-ingestion";

const schedulerLockKey = "redbot:subreddit-daily-poller:lock";
const schedulerId = randomUUID();
const schedulerRedis = new Redis(workerRedisConnection.url, {
  maxRetriesPerRequest: null,
});
const schedulerLockRetryMs = Math.min(30000, Math.max(5000, Math.floor(subredditDailySchedulerLockTtlMs / 4)));

void startSubredditDailyScheduler();

async function startSubredditDailyScheduler() {
  while (true) {
    try {
      const lockAcquired = await acquireSchedulerLock();

      if (!lockAcquired) {
        workerLogger.info(
          {
            retryMs: schedulerLockRetryMs,
          },
          "Subreddit daily poller is already active in another worker process",
        );
        await sleep(schedulerLockRetryMs);
        continue;
      }

      await runOwnedSchedulerLoop();
    } catch (error) {
      workerLogger.error(
        {
          error,
          retryMs: schedulerLockRetryMs,
        },
        "Subreddit daily poller startup loop failed; retrying",
      );
    }

    await sleep(schedulerLockRetryMs);
  }
}

async function runOwnedSchedulerLoop() {
  const renewalInterval = setInterval(() => {
    void renewSchedulerLock().catch((error) => {
      workerLogger.error({ error }, "Subreddit daily poller lock renewal failed");
    });
  }, Math.max(1000, Math.floor(subredditDailySchedulerLockTtlMs / 2)));

  renewalInterval.unref?.();

  workerLogger.info(
    {
      schedulerId,
      baseDelayMs: subredditDailySchedulerBaseDelayMs,
      jitterMs: subredditDailySchedulerJitterMs,
      batchSize: subredditDailySchedulerBatchSize,
      batchSleepMs: subredditDailySchedulerBatchSleepMs,
      emptySleepMs: subredditDailySchedulerEmptySleepMs,
      lockTtlMs: subredditDailySchedulerLockTtlMs,
    },
    "Subreddit daily poller started",
  );

  try {
    await runSchedulerLoop();
  } catch (error) {
    workerLogger.error({ error }, "Subreddit daily poller stopped after an unrecoverable error");
  } finally {
    clearInterval(renewalInterval);
    await releaseSchedulerLock();
  }
}

async function runSchedulerLoop() {
  let subredditsSinceBatchPause = 0;

  while (await ownsSchedulerLock()) {
    if (await isDailyRssPollerPaused()) {
      workerLogger.info(
        { sleepMs: subredditDailySchedulerEmptySleepMs },
        "Subreddit daily poller is paused",
      );
      await sleep(subredditDailySchedulerEmptySleepMs);
      continue;
    }

    const subreddits = await loadActiveCampaignSubreddits();

    if (subreddits.length === 0) {
      workerLogger.info(
        { sleepMs: subredditDailySchedulerEmptySleepMs },
        "Subreddit daily poller found no active campaign subreddits",
      );
      await sleep(subredditDailySchedulerEmptySleepMs);
      continue;
    }

    for (const subreddit of subreddits) {
      if (await isDailyRssPollerPaused()) {
        workerLogger.info(
          { sleepMs: subredditDailySchedulerEmptySleepMs },
          "Subreddit daily poller paused before next subreddit",
        );
        await sleep(subredditDailySchedulerEmptySleepMs);
        break;
      }

      if (!(await ownsSchedulerLock())) {
        workerLogger.warn({ schedulerId }, "Subreddit daily poller lost lock");
        return;
      }

      const jobId = `subreddit-daily-poller:${schedulerId}:${Date.now()}:${subreddit}`;

      if (!(await isSubredditTrackedByActiveCampaign(subreddit))) {
        workerLogger.info(
          {
            jobId,
            subreddit,
          },
          "Skipping daily subreddit poll because subreddit is no longer tracked by an active campaign",
        );
        continue;
      }

      try {
        await runSubredditDailyIngest(
          {
            subreddit,
            trigger: "subreddit_daily_scheduler",
          },
          jobId,
          {
            useRedditRequestSlot: false,
          },
        );

        workerLogger.info({ subreddit }, "Subreddit daily poll completed");
      } catch (error) {
        workerLogger.error(
          {
            jobId,
            subreddit,
            error,
          },
          "Subreddit daily poll failed",
        );
      }

      subredditsSinceBatchPause += 1;

      if (
        subredditDailySchedulerBatchSleepMs > 0
        && subredditsSinceBatchPause >= subredditDailySchedulerBatchSize
      ) {
        subredditsSinceBatchPause = 0;
        workerLogger.info(
          {
            batchSize: subredditDailySchedulerBatchSize,
            sleepMs: subredditDailySchedulerBatchSleepMs,
          },
          "Subreddit daily poller batch pause started",
        );
        await sleep(subredditDailySchedulerBatchSleepMs);
        continue;
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

async function isSubredditTrackedByActiveCampaign(subreddit: string) {
  const campaignCount = await prisma.campaign.count({
    where: {
      isActive: true,
      subreddits: {
        has: subreddit,
      },
    },
  });

  return campaignCount > 0;
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
