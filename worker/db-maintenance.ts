import "dotenv/config";

import { prisma } from "@/lib/prisma";
import {
  getDbMaintenanceConfig,
  runDbMaintenance,
  type DbMaintenanceStats,
} from "@/lib/db-maintenance";

import { workerLogger } from "./logger";

const args = new Set(process.argv.slice(2));
const runOnce = args.has("--once");
const dryRun = args.has("--dry-run");
const vacuum = !args.has("--no-vacuum");
let shouldStop = false;
let wakeSleep: (() => void) | null = null;

process.on("SIGINT", () => {
  shouldStop = true;
  wakeSleep?.();
  workerLogger.info("DB maintenance worker received SIGINT");
});

process.on("SIGTERM", () => {
  shouldStop = true;
  wakeSleep?.();
  workerLogger.info("DB maintenance worker received SIGTERM");
});

void main();

async function main() {
  const config = getDbMaintenanceConfig();

  workerLogger.info(
    {
      dryRun,
      intervalMs: config.intervalMs,
      redditItemRetentionHours: config.redditItemRetentionHours,
      runOnce,
      vacuum,
    },
    "DB maintenance worker started",
  );

  try {
    if (runOnce) {
      const stats = await runOnceWithLogging(config, dryRun, vacuum);

      workerLogger.info({ stats }, "DB maintenance one-off run finished");
      return;
    }

    while (!shouldStop) {
      await runOnceWithLogging(config, dryRun, vacuum);

      if (shouldStop) {
        break;
      }

      await sleep(config.intervalMs);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function runOnceWithLogging(
  config: ReturnType<typeof getDbMaintenanceConfig>,
  isDryRun: boolean,
  shouldVacuum: boolean,
) {
  try {
    const stats = await runDbMaintenance({
      config,
      dryRun: isDryRun,
      vacuum: shouldVacuum,
    });

    logMaintenanceStats(stats);
    return stats;
  } catch (error) {
    workerLogger.error({ error }, "DB maintenance run failed");
    throw error;
  }
}

function logMaintenanceStats(stats: DbMaintenanceStats) {
  const failedVacuumTables = stats.vacuum.filter((item) => !item.ok);

  workerLogger.info(
    {
      aiUsageEventsDeleted: stats.aiUsageEventsDeleted,
      campaignInitialRssPollEventsDeleted: stats.campaignInitialRssPollEventsDeleted,
      campaignRunsDeleted: stats.campaignRunsDeleted,
      cronRunsDeleted: stats.cronRunsDeleted,
      dryRun: stats.dryRun,
      durationMs: stats.durationMs,
      failedVacuumTables,
      redditItemEmbeddingSourceTextCleared: stats.redditItemEmbeddingSourceTextCleared,
      redditItemRawJsonCleared: stats.redditItemRawJsonCleared,
      redditItemsDeleted: stats.redditItemsDeleted,
      sessionsDeleted: stats.sessionsDeleted,
      skipped: stats.skipped,
      skipReason: stats.skipReason,
      subredditRssPollEventsDeleted: stats.subredditRssPollEventsDeleted,
      telegramPairingsDeleted: stats.telegramPairingsDeleted,
      timedOut: stats.timedOut,
      trackedThreadsDeleted: stats.trackedThreadsDeleted,
      vacuumedTables: stats.vacuum.filter((item) => item.ok).map((item) => item.table),
      verificationTokensDeleted: stats.verificationTokensDeleted,
    },
    "DB maintenance run completed",
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      wakeSleep = null;
      resolve(undefined);
    }, ms);

    wakeSleep = () => {
      clearTimeout(timeout);
      wakeSleep = null;
      resolve(undefined);
    };
  });
}
