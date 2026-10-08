import Redis from "ioredis";

import { workerEnv, workerRedisConnection } from "./config";
import { workerLogger } from "./logger";

const spacingMs = 30_000;
const key = "redbot:rss-poll:nuveca:next-request-ms";
let redis: Redis | undefined;

export async function waitForDedicatedRssSlot() {
  if (workerEnv.RSS_POLL_QUEUE_NAME !== "rss-polling-nuveca-first") {
    return;
  }

  redis ??= new Redis(workerRedisConnection.url, {
    maxRetriesPerRequest: null,
    connectTimeout: 10_000,
    keepAlive: 30_000,
  });
  const waitMs = Number(await redis.eval(
    `
      local now = tonumber(ARGV[1])
      local spacing = tonumber(ARGV[2])
      local nextAt = tonumber(redis.call("GET", KEYS[1]) or "0")
      local wait = math.max(0, nextAt - now)
      redis.call("SET", KEYS[1], now + wait + spacing, "PX", 120000)
      return wait
    `,
    1,
    key,
    Date.now(),
    spacingMs,
  ));

  if (waitMs > 0) {
    workerLogger.info({ waitMs }, "Waiting for shared Nuveca RSS request slot");
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}
