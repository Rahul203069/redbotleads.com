import "dotenv/config";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const ADVISORY_LOCK_NAMESPACE = 312471;
const ADVISORY_LOCK_KEY = 982113;
const DEFAULT_INTERVAL_MS = 4 * 60 * 60 * 1000;
const DEFAULT_REDDIT_ITEM_RETENTION_HOURS = 48;
const DEFAULT_RAW_JSON_RETENTION_HOURS = 24;
const DEFAULT_RSS_EVENT_RETENTION_HOURS = 48;
const DEFAULT_INITIAL_RSS_EVENT_RETENTION_DAYS = 7;
const DEFAULT_RUN_RETENTION_DAYS = 14;
const DEFAULT_AI_USAGE_RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_MAX_RUNTIME_MS = 45_000;

type MaintenanceDb = typeof prisma | Prisma.TransactionClient;

export type DbMaintenanceConfig = {
  aiUsageRetentionDays: number;
  batchSize: number;
  initialRssEventRetentionDays: number;
  intervalMs: number;
  maxRuntimeMs: number;
  rawJsonRetentionHours: number;
  redditItemRetentionHours: number;
  rssEventRetentionHours: number;
  runRetentionDays: number;
  vacuumEnabled: boolean;
};

export type DbMaintenanceStats = {
  aiUsageEventsDeleted: number;
  campaignInitialRssPollEventsDeleted: number;
  campaignRunsDeleted: number;
  completedAt: string;
  cronRunsDeleted: number;
  dryRun: boolean;
  durationMs: number;
  redditItemEmbeddingSourceTextCleared: number;
  redditItemRawJsonCleared: number;
  redditItemsDeleted: number;
  sessionsDeleted: number;
  skipped: boolean;
  skipReason: string | null;
  startedAt: string;
  subredditRssPollEventsDeleted: number;
  telegramPairingsDeleted: number;
  timedOut: boolean;
  trackedThreadsDeleted: number;
  vacuum: Array<{
    error?: string;
    ok: boolean;
    table: string;
  }>;
  verificationTokensDeleted: number;
};

type MutableMaintenanceStats = Omit<DbMaintenanceStats, "completedAt" | "durationMs" | "vacuum"> & {
  vacuum: DbMaintenanceStats["vacuum"];
};

export function getDbMaintenanceConfig(env: NodeJS.ProcessEnv = process.env): DbMaintenanceConfig {
  return {
    aiUsageRetentionDays: readPositiveInt(env.DB_MAINTENANCE_AI_USAGE_RETENTION_DAYS, DEFAULT_AI_USAGE_RETENTION_DAYS),
    batchSize: readPositiveInt(env.DB_MAINTENANCE_BATCH_SIZE, DEFAULT_BATCH_SIZE),
    initialRssEventRetentionDays: readPositiveInt(
      env.DB_MAINTENANCE_INITIAL_RSS_EVENT_RETENTION_DAYS,
      DEFAULT_INITIAL_RSS_EVENT_RETENTION_DAYS,
    ),
    intervalMs: readPositiveInt(env.DB_MAINTENANCE_INTERVAL_MS, DEFAULT_INTERVAL_MS),
    maxRuntimeMs: readPositiveInt(env.DB_MAINTENANCE_MAX_RUNTIME_MS, DEFAULT_MAX_RUNTIME_MS),
    rawJsonRetentionHours: readPositiveInt(env.DB_MAINTENANCE_RAW_JSON_RETENTION_HOURS, DEFAULT_RAW_JSON_RETENTION_HOURS),
    redditItemRetentionHours: Math.max(
      DEFAULT_REDDIT_ITEM_RETENTION_HOURS,
      readPositiveInt(env.DB_MAINTENANCE_REDDIT_ITEM_RETENTION_HOURS, DEFAULT_REDDIT_ITEM_RETENTION_HOURS),
    ),
    rssEventRetentionHours: readPositiveInt(env.DB_MAINTENANCE_RSS_EVENT_RETENTION_HOURS, DEFAULT_RSS_EVENT_RETENTION_HOURS),
    runRetentionDays: readPositiveInt(env.DB_MAINTENANCE_RUN_RETENTION_DAYS, DEFAULT_RUN_RETENTION_DAYS),
    vacuumEnabled: readBoolean(env.DB_MAINTENANCE_VACUUM_ENABLED, true),
  };
}

export async function runDbMaintenance(options?: {
  config?: DbMaintenanceConfig;
  dryRun?: boolean;
  vacuum?: boolean;
}): Promise<DbMaintenanceStats> {
  const config = options?.config ?? getDbMaintenanceConfig();
  const dryRun = options?.dryRun ?? false;
  const startedAt = new Date();
  const startedMs = Date.now();
  const deadlineMs = startedMs + config.maxRuntimeMs;
  const stats = createInitialStats(startedAt, dryRun);

  const transactionResult = await prisma.$transaction(
    async (tx) => {
      const locked = await tryAcquireMaintenanceLock(tx);

      if (!locked) {
        stats.skipped = true;
        stats.skipReason = "db_maintenance_lock_held";
        return stats;
      }

      if (dryRun) {
        await collectDryRunStats(tx, config, stats);
        return stats;
      }

      await runCleanupBatches(tx, config, stats, deadlineMs);
      return stats;
    },
    {
      maxWait: 5_000,
      timeout: Math.max(config.maxRuntimeMs + 15_000, 60_000),
    },
  );

  if (!transactionResult.skipped && !transactionResult.dryRun && (options?.vacuum ?? config.vacuumEnabled)) {
    transactionResult.vacuum = await vacuumHighChurnTables();
  }

  return finalizeStats(transactionResult, startedMs);
}

function createInitialStats(startedAt: Date, dryRun: boolean): MutableMaintenanceStats {
  return {
    aiUsageEventsDeleted: 0,
    campaignInitialRssPollEventsDeleted: 0,
    campaignRunsDeleted: 0,
    cronRunsDeleted: 0,
    dryRun,
    redditItemEmbeddingSourceTextCleared: 0,
    redditItemRawJsonCleared: 0,
    redditItemsDeleted: 0,
    sessionsDeleted: 0,
    skipped: false,
    skipReason: null,
    startedAt: startedAt.toISOString(),
    subredditRssPollEventsDeleted: 0,
    telegramPairingsDeleted: 0,
    timedOut: false,
    trackedThreadsDeleted: 0,
    vacuum: [],
    verificationTokensDeleted: 0,
  };
}

function finalizeStats(stats: MutableMaintenanceStats, startedMs: number): DbMaintenanceStats {
  return {
    ...stats,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedMs,
  };
}

async function tryAcquireMaintenanceLock(db: MaintenanceDb) {
  const rows = await db.$queryRaw<Array<{ locked: boolean }>>(
    Prisma.sql`
      SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_NAMESPACE}, ${ADVISORY_LOCK_KEY}) AS "locked"
    `,
  );

  return rows[0]?.locked === true;
}

async function collectDryRunStats(
  db: MaintenanceDb,
  config: DbMaintenanceConfig,
  stats: MutableMaintenanceStats,
) {
  const now = new Date();
  const redditItemCutoff = subtractHours(now, config.redditItemRetentionHours);
  const rawJsonCutoff = subtractHours(now, config.rawJsonRetentionHours);
  const rssEventCutoff = subtractHours(now, config.rssEventRetentionHours);
  const initialRssEventCutoff = subtractDays(now, config.initialRssEventRetentionDays);
  const runCutoff = subtractDays(now, config.runRetentionDays);
  const aiUsageCutoff = subtractDays(now, config.aiUsageRetentionDays);

  stats.redditItemsDeleted = await queryCount(
    db,
    Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "RedditItem" "ri"
      WHERE "ri"."fetchedAt" < ${redditItemCutoff}
        AND NOT EXISTS (
          SELECT 1
          FROM "Lead" "l"
          WHERE "l"."redditItemId" = "ri"."id"
        )
    `,
  );
  stats.redditItemRawJsonCleared = await queryCount(
    db,
    Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "RedditItem"
      WHERE "rawJson" IS NOT NULL
        AND "fetchedAt" < ${rawJsonCutoff}
    `,
  );
  stats.redditItemEmbeddingSourceTextCleared = await queryCount(
    db,
    Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "RedditItemEmbedding"
      WHERE "sourceText" IS NOT NULL
        AND "createdAt" < ${rawJsonCutoff}
    `,
  );
  stats.subredditRssPollEventsDeleted = await countRowsBefore(db, "SubredditRssPollEvent", "requestedAt", rssEventCutoff);
  stats.campaignInitialRssPollEventsDeleted = await countRowsBefore(
    db,
    "CampaignInitialRssPollEvent",
    "requestedAt",
    initialRssEventCutoff,
  );
  stats.campaignRunsDeleted = await queryCount(
    db,
    Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "CampaignRun"
      WHERE "status" IN ('COMPLETED', 'FAILED')
        AND COALESCE("completedAt", "failedAt", "updatedAt") < ${runCutoff}
    `,
  );
  stats.cronRunsDeleted = await queryCount(
    db,
    Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "CronRun"
      WHERE "status" IN ('COMPLETED', 'FAILED')
        AND COALESCE("completedAt", "failedAt", "updatedAt") < ${runCutoff}
    `,
  );
  stats.aiUsageEventsDeleted = await countRowsBefore(db, "AiUsageEvent", "createdAt", aiUsageCutoff);
  stats.sessionsDeleted = await countRowsBefore(db, "Session", "expires", now);
  stats.verificationTokensDeleted = await countRowsBefore(db, "VerificationToken", "expires", now);
  stats.telegramPairingsDeleted = await countRowsBefore(db, "TelegramPairing", "expiresAt", now);
  stats.trackedThreadsDeleted = await countRowsBefore(db, "TrackedThread", "expiresAt", now);
}

async function runCleanupBatches(
  db: MaintenanceDb,
  config: DbMaintenanceConfig,
  stats: MutableMaintenanceStats,
  deadlineMs: number,
) {
  const now = new Date();
  const redditItemCutoff = subtractHours(now, config.redditItemRetentionHours);
  const rawJsonCutoff = subtractHours(now, config.rawJsonRetentionHours);
  const rssEventCutoff = subtractHours(now, config.rssEventRetentionHours);
  const initialRssEventCutoff = subtractDays(now, config.initialRssEventRetentionDays);
  const runCutoff = subtractDays(now, config.runRetentionDays);
  const aiUsageCutoff = subtractDays(now, config.aiUsageRetentionDays);

  stats.redditItemsDeleted = await runBatchedCleanup({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    stats,
    sql: (batchSize) => Prisma.sql`
      WITH "candidates" AS (
        SELECT "ri"."id"
        FROM "RedditItem" "ri"
        WHERE "ri"."fetchedAt" < ${redditItemCutoff}
          AND NOT EXISTS (
            SELECT 1
            FROM "Lead" "l"
            WHERE "l"."redditItemId" = "ri"."id"
          )
        ORDER BY "ri"."fetchedAt" ASC
        LIMIT ${batchSize}
      ),
      "deleted" AS (
        DELETE FROM "RedditItem" "ri"
        USING "candidates" "c"
        WHERE "ri"."id" = "c"."id"
        RETURNING 1
      )
      SELECT COUNT(*)::int AS "count"
      FROM "deleted"
    `,
  });

  stats.redditItemRawJsonCleared = await runBatchedCleanup({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    stats,
    sql: (batchSize) => Prisma.sql`
      WITH "candidates" AS (
        SELECT "id"
        FROM "RedditItem"
        WHERE "rawJson" IS NOT NULL
          AND "fetchedAt" < ${rawJsonCutoff}
        ORDER BY "fetchedAt" ASC
        LIMIT ${batchSize}
      ),
      "updated" AS (
        UPDATE "RedditItem" "ri"
        SET "rawJson" = NULL
        FROM "candidates" "c"
        WHERE "ri"."id" = "c"."id"
        RETURNING 1
      )
      SELECT COUNT(*)::int AS "count"
      FROM "updated"
    `,
  });

  stats.redditItemEmbeddingSourceTextCleared = await runBatchedCleanup({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    stats,
    sql: (batchSize) => Prisma.sql`
      WITH "candidates" AS (
        SELECT "id"
        FROM "RedditItemEmbedding"
        WHERE "sourceText" IS NOT NULL
          AND "createdAt" < ${rawJsonCutoff}
        ORDER BY "createdAt" ASC
        LIMIT ${batchSize}
      ),
      "updated" AS (
        UPDATE "RedditItemEmbedding" "rie"
        SET "sourceText" = NULL
        FROM "candidates" "c"
        WHERE "rie"."id" = "c"."id"
        RETURNING 1
      )
      SELECT COUNT(*)::int AS "count"
      FROM "updated"
    `,
  });

  stats.subredditRssPollEventsDeleted = await deleteRowsBefore({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    orderColumn: "requestedAt",
    stats,
    table: "SubredditRssPollEvent",
    whereColumn: "requestedAt",
    cutoff: rssEventCutoff,
  });
  stats.campaignInitialRssPollEventsDeleted = await deleteRowsBefore({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    orderColumn: "requestedAt",
    stats,
    table: "CampaignInitialRssPollEvent",
    whereColumn: "requestedAt",
    cutoff: initialRssEventCutoff,
  });
  stats.campaignRunsDeleted = await runBatchedCleanup({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    stats,
    sql: (batchSize) => Prisma.sql`
      WITH "candidates" AS (
        SELECT "id"
        FROM "CampaignRun"
        WHERE "status" IN ('COMPLETED', 'FAILED')
          AND COALESCE("completedAt", "failedAt", "updatedAt") < ${runCutoff}
        ORDER BY COALESCE("completedAt", "failedAt", "updatedAt") ASC
        LIMIT ${batchSize}
      ),
      "deleted" AS (
        DELETE FROM "CampaignRun" "cr"
        USING "candidates" "c"
        WHERE "cr"."id" = "c"."id"
        RETURNING 1
      )
      SELECT COUNT(*)::int AS "count"
      FROM "deleted"
    `,
  });
  stats.cronRunsDeleted = await runBatchedCleanup({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    stats,
    sql: (batchSize) => Prisma.sql`
      WITH "candidates" AS (
        SELECT "id"
        FROM "CronRun"
        WHERE "status" IN ('COMPLETED', 'FAILED')
          AND COALESCE("completedAt", "failedAt", "updatedAt") < ${runCutoff}
        ORDER BY COALESCE("completedAt", "failedAt", "updatedAt") ASC
        LIMIT ${batchSize}
      ),
      "deleted" AS (
        DELETE FROM "CronRun" "cr"
        USING "candidates" "c"
        WHERE "cr"."id" = "c"."id"
        RETURNING 1
      )
      SELECT COUNT(*)::int AS "count"
      FROM "deleted"
    `,
  });
  stats.aiUsageEventsDeleted = await deleteRowsBefore({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    orderColumn: "createdAt",
    stats,
    table: "AiUsageEvent",
    whereColumn: "createdAt",
    cutoff: aiUsageCutoff,
  });
  stats.sessionsDeleted = await deleteRowsBefore({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    orderColumn: "expires",
    stats,
    table: "Session",
    whereColumn: "expires",
    cutoff: now,
  });
  stats.verificationTokensDeleted = await deleteRowsBefore({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    orderColumn: "expires",
    stats,
    table: "VerificationToken",
    whereColumn: "expires",
    cutoff: now,
  });
  stats.telegramPairingsDeleted = await deleteRowsBefore({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    orderColumn: "expiresAt",
    stats,
    table: "TelegramPairing",
    whereColumn: "expiresAt",
    cutoff: now,
  });
  stats.trackedThreadsDeleted = await deleteRowsBefore({
    db,
    batchSize: config.batchSize,
    deadlineMs,
    orderColumn: "expiresAt",
    stats,
    table: "TrackedThread",
    whereColumn: "expiresAt",
    cutoff: now,
  });
}

async function runBatchedCleanup({
  batchSize,
  db,
  deadlineMs,
  sql,
  stats,
}: {
  batchSize: number;
  db: MaintenanceDb;
  deadlineMs: number;
  sql: (batchSize: number) => Prisma.Sql;
  stats: MutableMaintenanceStats;
}) {
  let total = 0;

  while (Date.now() < deadlineMs) {
    const count = await queryCount(db, sql(batchSize));
    total += count;

    if (count < batchSize) {
      return total;
    }
  }

  stats.timedOut = true;
  return total;
}

async function deleteRowsBefore({
  batchSize,
  cutoff,
  db,
  deadlineMs,
  orderColumn,
  stats,
  table,
  whereColumn,
}: {
  batchSize: number;
  cutoff: Date;
  db: MaintenanceDb;
  deadlineMs: number;
  orderColumn: string;
  stats: MutableMaintenanceStats;
  table: string;
  whereColumn: string;
}) {
  return runBatchedCleanup({
    db,
    batchSize,
    deadlineMs,
    stats,
    sql: (limit) => Prisma.sql`
      WITH "candidates" AS (
        SELECT "ctid"
        FROM ${rawIdentifier(table)}
        WHERE ${rawIdentifier(whereColumn)} < ${cutoff}
        ORDER BY ${rawIdentifier(orderColumn)} ASC
        LIMIT ${limit}
      ),
      "deleted" AS (
        DELETE FROM ${rawIdentifier(table)} "target"
        USING "candidates" "c"
        WHERE "target"."ctid" = "c"."ctid"
        RETURNING 1
      )
      SELECT COUNT(*)::int AS "count"
      FROM "deleted"
    `,
  });
}

async function countRowsBefore(db: MaintenanceDb, table: string, column: string, cutoff: Date) {
  return queryCount(
    db,
    Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM ${rawIdentifier(table)}
      WHERE ${rawIdentifier(column)} < ${cutoff}
    `,
  );
}

async function queryCount(db: MaintenanceDb, sql: Prisma.Sql) {
  const rows = await db.$queryRaw<Array<{ count: number }>>(sql);

  return Number(rows[0]?.count ?? 0);
}

async function vacuumHighChurnTables() {
  const tables = [
    "RedditItem",
    "RedditItemEmbedding",
    "SubredditRssPollEvent",
    "CampaignInitialRssPollEvent",
    "CampaignDailySemanticScan",
    "CampaignRun",
    "CronRun",
    "AiUsageEvent",
    "Session",
    "VerificationToken",
    "TelegramPairing",
    "TrackedThread",
  ];
  const results: DbMaintenanceStats["vacuum"] = [];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`VACUUM (ANALYZE) "${table}"`);
      results.push({
        ok: true,
        table,
      });
    } catch (error) {
      results.push({
        error: error instanceof Error ? error.message : String(error),
        ok: false,
        table,
      });
    }
  }

  return results;
}

function subtractHours(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function subtractDays(date: Date, days: number) {
  return subtractHours(date, days * 24);
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function rawIdentifier(value: string) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }

  return Prisma.raw(`"${value}"`);
}
