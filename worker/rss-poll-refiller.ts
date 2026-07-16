import "dotenv/config";

import { randomUUID } from "node:crypto";
import Redis from "ioredis";

import { getDailyRssSubredditPool } from "@/lib/daily-rss-subreddit-pool";
import { prisma } from "@/lib/prisma";
import { normalizeSubredditName } from "@/lib/subreddit-polling-settings";

import {
  rssPollRefillHighWatermark,
  rssPollRefillIntervalMs,
  rssPollRefillLockTtlMs,
  rssPollRefillLowWatermark,
  workerRedisConnection,
} from "./config";
import { workerLogger } from "./logger";
import {
  enqueueSubredditRssPoll,
  pollSubredditRssJobName,
  rssPollingQueue,
} from "./queues";

const refillerId = randomUUID();
const lockKey = "redbot:rss-poll-refiller:lock";
const cursorKey = "redbot:rss-poll-refiller:cursor";
const liveJobStates = ["waiting", "active", "delayed", "prioritized"] as const;
const maxJobsToScan = 5000;

const redis = new Redis(workerRedisConnection.url, {
  maxRetriesPerRequest: null,
});

void startRssPollRefiller();

async function startRssPollRefiller() {
  workerLogger.info(
    {
      refillerId,
      lowWatermark: rssPollRefillLowWatermark,
      highWatermark: rssPollRefillHighWatermark,
      intervalMs: rssPollRefillIntervalMs,
      lockTtlMs: rssPollRefillLockTtlMs,
    },
    "RSS poll refiller started",
  );

  while (true) {
    try {
      await refillIfNeeded();
    } catch (error) {
      workerLogger.error({ error }, "RSS poll refiller iteration failed");
    }

    await sleep(rssPollRefillIntervalMs);
  }
}

async function refillIfNeeded() {
  const lockAcquired = await acquireLock();

  if (!lockAcquired) {
    workerLogger.info({ refillerId }, "RSS poll refiller lock is held by another process");
    return;
  }

  try {
    const livePollJobs = await getLivePollJobs();
    const livePollCount = livePollJobs.length;

    if (livePollCount >= rssPollRefillLowWatermark) {
      workerLogger.info(
        {
          livePollCount,
          lowWatermark: rssPollRefillLowWatermark,
        },
        "RSS poll queue is above refill watermark",
      );
      return;
    }

    const targetToAdd = Math.max(0, rssPollRefillHighWatermark - livePollCount);

    if (targetToAdd === 0) {
      return;
    }

    const liveSubreddits = new Set(
      livePollJobs
        .map((job) => normalizeSubredditName(String((job.data as Record<string, unknown> | undefined)?.subreddit ?? "")))
        .filter(Boolean),
    );
    const candidates = await loadCircularCandidates({
      maxCandidates: targetToAdd,
      liveSubreddits,
    });

    if (candidates.subreddits.length === 0) {
      workerLogger.info(
        {
          livePollCount,
          activeSubreddits: candidates.activeSubreddits,
          disabledSkipped: candidates.disabledSkipped,
          backedOffSkipped: candidates.backedOffSkipped,
          duplicateSkipped: candidates.duplicateSkipped,
        },
        "RSS poll refiller found no eligible subreddits to enqueue",
      );
      return;
    }

    const results = await Promise.allSettled(
      candidates.subreddits.map((subreddit) =>
        enqueueSubredditRssPoll({
          subreddit,
          trigger: "rss_poll",
        }),
      ),
    );

    const queuedSubreddits: string[] = [];
    const failures: Array<{ subreddit: string; message: string }> = [];

    results.forEach((result, index) => {
      const subreddit = candidates.subreddits[index];

      if (!subreddit) {
        return;
      }

      if (result.status === "fulfilled") {
        queuedSubreddits.push(subreddit);
        return;
      }

      failures.push({
        subreddit,
        message: result.reason instanceof Error ? result.reason.message : "RSS poll enqueue failed.",
      });
    });

    workerLogger.info(
      {
        livePollCount,
        requested: targetToAdd,
        queued: queuedSubreddits.length,
        failed: failures.length,
        nextCursor: candidates.nextCursor,
        activeSubreddits: candidates.activeSubreddits,
        disabledSkipped: candidates.disabledSkipped,
        backedOffSkipped: candidates.backedOffSkipped,
        duplicateSkipped: candidates.duplicateSkipped,
        failures,
      },
      "RSS poll refiller completed enqueue pass",
    );
  } finally {
    await releaseLock();
  }
}

async function getLivePollJobs() {
  const jobs = await rssPollingQueue.getJobs([...liveJobStates], 0, maxJobsToScan, true);
  return jobs.filter((job) => job.name === pollSubredditRssJobName);
}

async function loadCircularCandidates({
  maxCandidates,
  liveSubreddits,
}: {
  maxCandidates: number;
  liveSubreddits: Set<string>;
}) {
  const now = new Date();
  const { allSubreddits, enabledSubreddits } = await getDailyRssSubredditPool();
  const cursorBySubreddit = new Map(
    (
      await prisma.ingestCursor.findMany({
        where: {
          subreddit: {
            in: enabledSubreddits,
          },
        },
        select: {
          subreddit: true,
          backoffUntil: true,
        },
      })
    ).map((cursor) => [normalizeSubredditName(cursor.subreddit), cursor]),
  );
  const cursor = await getCursor(enabledSubreddits.length);
  const orderedSubreddits = rotate(enabledSubreddits, cursor);
  const selected: string[] = [];
  let inspectedSubreddits = 0;
  let backedOffSkipped = 0;
  let duplicateSkipped = 0;

  for (const subreddit of orderedSubreddits) {
    if (selected.length >= maxCandidates) {
      break;
    }

    inspectedSubreddits += 1;

    if (liveSubreddits.has(subreddit)) {
      duplicateSkipped += 1;
      continue;
    }

    const backoffUntil = cursorBySubreddit.get(subreddit)?.backoffUntil;

    if (backoffUntil && backoffUntil.getTime() > now.getTime()) {
      backedOffSkipped += 1;
      continue;
    }

    selected.push(subreddit);
  }

  const nextCursor = enabledSubreddits.length === 0
    ? 0
    : (cursor + Math.max(1, inspectedSubreddits)) % enabledSubreddits.length;
  await redis.set(cursorKey, String(nextCursor));

  return {
    subreddits: selected,
    nextCursor,
    activeSubreddits: allSubreddits.length,
    disabledSkipped: allSubreddits.length - enabledSubreddits.length,
    backedOffSkipped,
    duplicateSkipped,
  };
}

async function getCursor(subredditCount: number) {
  if (subredditCount <= 0) {
    return 0;
  }

  const rawCursor = await redis.get(cursorKey);
  const cursor = Number.parseInt(String(rawCursor ?? "0"), 10);

  if (!Number.isFinite(cursor) || cursor < 0) {
    return 0;
  }

  return cursor % subredditCount;
}

function rotate<T>(items: T[], startIndex: number) {
  if (items.length === 0) {
    return [];
  }

  const index = Math.max(0, Math.min(startIndex, items.length - 1));
  return [...items.slice(index), ...items.slice(0, index)];
}

async function acquireLock() {
  const result = await redis.set(lockKey, refillerId, "PX", rssPollRefillLockTtlMs, "NX");
  return result === "OK";
}

async function releaseLock() {
  await redis.eval(
    `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end

      return 0
    `,
    1,
    lockKey,
    refillerId,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
