import Redis from "ioredis";

import { workerRedisConnection } from "@/worker/config";

const dailyRssPollerPauseKey = "redbot:subreddit-daily-poller:paused";

const redis = new Redis(workerRedisConnection.url, {
  maxRetriesPerRequest: null,
});

export type DailyRssPollerPauseState = {
  paused: boolean;
  pausedAt: string | null;
  pausedBy: string | null;
};

export async function getDailyRssPollerPauseState(): Promise<DailyRssPollerPauseState> {
  const value = await redis.get(dailyRssPollerPauseKey);

  if (!value) {
    return {
      paused: false,
      pausedAt: null,
      pausedBy: null,
    };
  }

  try {
    const parsed = JSON.parse(value) as Partial<DailyRssPollerPauseState>;

    return {
      paused: true,
      pausedAt: typeof parsed.pausedAt === "string" ? parsed.pausedAt : null,
      pausedBy: typeof parsed.pausedBy === "string" ? parsed.pausedBy : null,
    };
  } catch {
    return {
      paused: true,
      pausedAt: null,
      pausedBy: null,
    };
  }
}

export async function isDailyRssPollerPaused() {
  const state = await getDailyRssPollerPauseState();
  return state.paused;
}

export async function pauseDailyRssPoller(input: {
  pausedAt: Date;
  pausedBy: string | null;
}) {
  await redis.set(
    dailyRssPollerPauseKey,
    JSON.stringify({
      paused: true,
      pausedAt: input.pausedAt.toISOString(),
      pausedBy: input.pausedBy,
    }),
  );
}

export async function resumeDailyRssPoller() {
  await redis.del(dailyRssPollerPauseKey);
}
