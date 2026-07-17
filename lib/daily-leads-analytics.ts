import { prisma } from "@/lib/prisma";
import { addDaysToDateKey, getDateKeyInTimeZone, normalizeTimeZone } from "@/lib/time-zone";

export const DAILY_SEMANTIC_CRON_PATH = "/api/cron/daily-semantic";
export const DAILY_STRONG_LEAD_SCORE = 75;
export const DAILY_LEADS_PAGE_SIZE = 50;
export const DAILY_LEAD_SEMANTIC_STATUS_OPTIONS = ["ALL", "MATCHED", "NO_MATCH"] as const;
const CLASSIFICATION_ERROR_MODEL = "classification-error";

export type DailyLeadDateRange = {
  from: Date;
  to: Date;
  source: "all" | "query" | "server";
};
export type DailyLeadDateRangeValue = {
  from: Date;
  to: Date;
};
export type DailyLeadDateSelection = {
  dateStarts: string[];
  range: DailyLeadDateRange;
  ranges: DailyLeadDateRangeValue[];
  source: DailyLeadDateRange["source"] | "dates";
};

export type DailyLeadSemanticStatusFilter = (typeof DAILY_LEAD_SEMANTIC_STATUS_OPTIONS)[number];
export type DailyLeadAnalytics = Awaited<ReturnType<typeof getDailyLeadAnalytics>>;
export type DailyLeadTrendRow = {
  day: string;
  label: string;
  scanned: number;
  semanticMatches: number;
  strongLeads: number;
  notStrongLeads: number;
  pendingClassifications: number;
  classificationFailures: number;
};

export function parseDailyLeadsPage(value: string | number | undefined) {
  const page = Number(value);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

export function parseDailyLeadSemanticStatus(value: string | undefined): DailyLeadSemanticStatusFilter {
  const normalized = String(value ?? "ALL").trim().toUpperCase();

  return DAILY_LEAD_SEMANTIC_STATUS_OPTIONS.includes(normalized as DailyLeadSemanticStatusFilter)
    ? normalized as DailyLeadSemanticStatusFilter
    : "ALL";
}

export function getDailyLeadDateRange(input: {
  date?: string | string[];
  from?: string;
  range?: string;
  to?: string;
}): DailyLeadDateRange {
  if (input.range === "all") {
    return {
      from: new Date(0),
      to: new Date(Date.now() + 60 * 1000),
      source: "all",
    };
  }

  const from = input.from ? new Date(input.from) : null;
  const to = input.to ? new Date(input.to) : null;

  if (from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to) {
    return {
      from,
      to,
      source: "query",
    };
  }

  const now = new Date();
  const fallbackFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const fallbackTo = new Date(fallbackFrom.getTime() + 24 * 60 * 60 * 1000);

  return {
    from: fallbackFrom,
    to: fallbackTo,
    source: "server",
  };
}

export function getDailyLeadDateSelection(input: {
  date?: string | string[];
  from?: string;
  range?: string;
  to?: string;
}): DailyLeadDateSelection {
  const dateRanges = parseDailyLeadDateRanges(input.date);

  if (dateRanges.length > 0) {
    return {
      dateStarts: dateRanges.map((range) => range.from.toISOString()),
      range: {
        from: dateRanges[0].from,
        to: dateRanges[dateRanges.length - 1].to,
        source: "query",
      },
      ranges: dateRanges,
      source: "dates",
    };
  }

  const range = getDailyLeadDateRange(input);

  return {
    dateStarts: [],
    range,
    ranges: [{ from: range.from, to: range.to }],
    source: range.source,
  };
}

function parseDailyLeadDateRanges(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const ranges = values
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const from = new Date(item);

      if (Number.isNaN(from.getTime())) {
        return null;
      }

      return {
        from,
        to: new Date(from.getTime() + 24 * 60 * 60 * 1000),
      };
    })
    .filter((range): range is DailyLeadDateRangeValue => range !== null)
    .sort((left, right) => left.from.getTime() - right.from.getTime());

  const seen = new Set<string>();

  return ranges.filter((range) => {
    const key = range.from.toISOString();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function getDailyLeadAnalytics({
  campaignId,
  from,
  to,
  userId,
  page = 1,
  pageSize = DAILY_LEADS_PAGE_SIZE,
  semanticStatus = "ALL",
  timeZone = "UTC",
}: {
  campaignId?: string;
  from: Date;
  to: Date;
  userId?: string;
  page?: number;
  pageSize?: number;
  semanticStatus?: DailyLeadSemanticStatusFilter;
  timeZone?: string;
}) {
  const currentPage = Math.max(1, Math.floor(page));
  const effectivePageSize = Math.max(1, Math.min(100, Math.floor(pageSize)));
  const skip = (currentPage - 1) * effectivePageSize;
  const campaignWhere = {
    ...(campaignId ? { id: campaignId } : {}),
    ...(userId ? { userId } : {}),
  };
  const scanWhere = {
    updatedAt: {
      gte: from,
      lt: to,
    },
    ...(semanticStatus === "ALL" ? {} : { status: semanticStatus }),
    ...(campaignId || userId
      ? {
          campaign: campaignWhere,
        }
      : {}),
  };
  const runWhere = {
    trigger: {
      in: ["DAILY_SEMANTIC", "MANUAL_SEMANTIC"],
    },
    createdAt: {
      gte: from,
      lt: to,
    },
    ...(campaignId || userId
      ? {
          campaign: campaignWhere,
        }
      : {}),
  };

  const [cronRuns, campaignRuns, scanStatusCounts, matchedScansForMetrics, scans, trendScans] = await Promise.all([
    prisma.cronRun.findMany({
      where: {
        path: DAILY_SEMANTIC_CRON_PATH,
        startedAt: {
          gte: from,
          lt: to,
        },
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 20,
    }),
    prisma.campaignRun.findMany({
      where: runWhere,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    }),
    prisma.campaignDailySemanticScan.groupBy({
      where: scanWhere,
      by: ["status"],
      _count: {
        _all: true,
      },
    }),
    prisma.campaignDailySemanticScan.findMany({
      where: {
        ...scanWhere,
        status: "MATCHED",
      },
      select: {
        campaignId: true,
        campaignRunId: true,
        redditItemId: true,
      },
    }),
    prisma.campaignDailySemanticScan.findMany({
      where: scanWhere,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
        campaignRun: {
          select: {
            id: true,
            status: true,
            message: true,
            statsJson: true,
          },
        },
        redditItem: {
          select: {
            id: true,
            subreddit: true,
            title: true,
            description: true,
            body: true,
            url: true,
            createdUtc: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      skip,
      take: effectivePageSize,
    }),
    prisma.campaignDailySemanticScan.findMany({
      where: scanWhere,
      select: {
        campaignId: true,
        redditItemId: true,
        status: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "asc",
      },
    }),
  ]);

  const pageLeadPairs = scans
    .filter((scan) => scan.status === "MATCHED")
    .map((scan) => ({
      campaignId: scan.campaignId,
      redditItemId: scan.redditItemId,
    }));
  const metricLeadPairs = matchedScansForMetrics.map((scan) => ({
    campaignId: scan.campaignId,
    redditItemId: scan.redditItemId,
  }));
  const [leads, metricLeads] = await Promise.all([
    pageLeadPairs.length === 0
    ? []
    : await prisma.lead.findMany({
        where: {
          OR: pageLeadPairs,
        },
        include: {
          ai: {
            select: {
              category: true,
              summary: true,
              disqualifier: true,
              model: true,
            },
          },
          notifications: {
            orderBy: {
              createdAt: "desc",
            },
            select: {
              campaignRunId: true,
              channel: true,
              status: true,
              error: true,
              sentAt: true,
              createdAt: true,
            },
          },
        },
      }),
    metricLeadPairs.length === 0
      ? []
      : prisma.lead.findMany({
          where: {
            OR: metricLeadPairs,
          },
          include: {
            ai: {
              select: {
                id: true,
                model: true,
              },
            },
            notifications: {
              select: {
                campaignRunId: true,
                status: true,
              },
            },
          },
        }),
  ]);
  const leadByPair = new Map(leads.map((lead) => [buildPairKey(lead.campaignId, lead.redditItemId), lead]));

  const rows = scans.map((scan) => {
    const lead = leadByPair.get(buildPairKey(scan.campaignId, scan.redditItemId)) ?? null;
    const notification =
      lead?.notifications.find((item) => item.campaignRunId && item.campaignRunId === scan.campaignRunId)
      ?? lead?.notifications[0]
      ?? null;
    const classificationFailed = lead?.ai?.model === CLASSIFICATION_ERROR_MODEL;
    const classified = Boolean(lead?.ai && !classificationFailed);
    const strong = classified && (lead?.score ?? 0) > DAILY_STRONG_LEAD_SCORE;

    return {
      id: scan.id,
      campaignId: scan.campaignId,
      campaignName: scan.campaign.name,
      owner: scan.campaign.user.email ?? scan.campaign.user.name ?? "Unknown user",
      campaignRunId: scan.campaignRunId,
      runStatus: scan.campaignRun?.status ?? "LEGACY",
      runMessage: scan.campaignRun?.message ?? null,
      scannedAt: scan.updatedAt,
      semanticStatus: scan.status,
      semanticScore: scan.bestScore,
      bestQueryText: scan.bestQueryText,
      redditItem: scan.redditItem,
      lead: lead
        ? {
            id: lead.id,
            aiModel: lead.ai?.model ?? null,
            classificationFailed,
            score: lead.score,
            label: lead.label,
            classified,
            strong,
            category: lead.ai?.category ?? null,
            summary: lead.ai?.summary ?? null,
            disqualifier: lead.ai?.disqualifier ?? null,
          }
        : null,
      notification,
    };
  });

  const totalScans = scanStatusCounts.reduce((sum, entry) => sum + entry._count._all, 0);
  const totalSemanticMatches =
    scanStatusCounts.find((entry) => entry.status === "MATCHED")?._count._all ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalScans / effectivePageSize));
  const metricLeadByPair = new Map(metricLeads.map((lead) => [buildPairKey(lead.campaignId, lead.redditItemId), lead]));
  const trendRows = buildDailyLeadTrendRows({
    from,
    leadByPair: metricLeadByPair,
    scans: trendScans,
    timeZone,
    to,
  });
  const matchedMetricRows = matchedScansForMetrics.map((scan) => {
    const lead = metricLeadByPair.get(buildPairKey(scan.campaignId, scan.redditItemId)) ?? null;
    const notification =
      lead?.notifications.find((item) => item.campaignRunId && item.campaignRunId === scan.campaignRunId)
      ?? lead?.notifications[0]
      ?? null;

    return {
      classificationFailed: lead?.ai?.model === CLASSIFICATION_ERROR_MODEL,
      classified: Boolean(lead?.ai && lead.ai.model !== CLASSIFICATION_ERROR_MODEL),
      notificationStatus: notification?.status ?? null,
      score: lead?.score ?? 0,
    };
  });
  const classifiedMetricRows = matchedMetricRows.filter((row) => row.classified);
  const failedMetricRows = matchedMetricRows.filter((row) => row.classificationFailed);

  return {
    cronRuns,
    campaignRuns,
    rows,
    trendRows,
    pagination: {
      page: currentPage,
      pageSize: effectivePageSize,
      totalRows: totalScans,
      totalPages,
      hasPreviousPage: currentPage > 1,
      hasNextPage: currentPage < totalPages,
    },
    filters: {
      semanticStatus,
    },
    metrics: {
      cronRuns: cronRuns.length,
      campaignsQueued: campaignRuns.length,
      candidatesScanned: totalScans,
      semanticMatches: totalSemanticMatches,
      totalLeadsFound: totalSemanticMatches,
      classifiedLeads: classifiedMetricRows.length,
      classificationFailedLeads: failedMetricRows.length,
      strongLeads: classifiedMetricRows.filter((row) => row.score > DAILY_STRONG_LEAD_SCORE).length,
      notStrongLeads: classifiedMetricRows.filter((row) => row.score <= DAILY_STRONG_LEAD_SCORE).length,
      pendingClassifications: matchedMetricRows.filter((row) => !row.classified && !row.classificationFailed).length,
      notificationsSent: matchedMetricRows.filter((row) => row.notificationStatus === "SENT").length,
      notificationsFailed: matchedMetricRows.filter((row) => row.notificationStatus === "FAILED").length,
    },
  };
}

function buildPairKey(campaignId: string, redditItemId: string) {
  return `${campaignId}:${redditItemId}`;
}

const MAX_FILLED_TREND_DAYS = 90;

function buildDailyLeadTrendRows({
  from,
  leadByPair,
  scans,
  timeZone,
  to,
}: {
  from: Date;
  leadByPair: Map<string, {
    ai: {
      model: string | null;
    } | null;
    campaignId: string;
    redditItemId: string;
    score: number;
  }>;
  scans: Array<{
    campaignId: string;
    redditItemId: string;
    status: "MATCHED" | "NO_MATCH";
    updatedAt: Date;
  }>;
  timeZone: string;
  to: Date;
}) {
  const buckets = new Map<string, DailyLeadTrendRow>();
  const safeTimeZone = normalizeTimeZone(timeZone);
  const startKey = getDateKeyInTimeZone(from, safeTimeZone);
  const endKey = getDateKeyInTimeZone(new Date(Math.max(from.getTime(), to.getTime() - 1)), safeTimeZone);
  const dayCount = getCalendarDayDistance(startKey, endKey) + 1;

  if (from.getUTCFullYear() > 2000 && dayCount > 0 && dayCount <= MAX_FILLED_TREND_DAYS) {
    for (let index = 0; index < dayCount; index += 1) {
      const key = addDaysToDateKey(startKey, index);
      buckets.set(key, createTrendBucket(key));
    }
  }

  for (const scan of scans) {
    const key = getDateKeyInTimeZone(scan.updatedAt, safeTimeZone);
    const bucket = buckets.get(key) ?? createTrendBucket(key);

    bucket.scanned += 1;

    if (scan.status === "MATCHED") {
      bucket.semanticMatches += 1;
      const lead = leadByPair.get(buildPairKey(scan.campaignId, scan.redditItemId));
      const classificationFailed = lead?.ai?.model === CLASSIFICATION_ERROR_MODEL;
      const classified = Boolean(lead?.ai && !classificationFailed);

      if (classificationFailed) {
        bucket.classificationFailures += 1;
      } else if (classified && lead) {
        if (lead.score > DAILY_STRONG_LEAD_SCORE) {
          bucket.strongLeads += 1;
        } else {
          bucket.notStrongLeads += 1;
        }
      } else {
        bucket.pendingClassifications += 1;
      }
    }

    buckets.set(key, bucket);
  }

  return Array.from(buckets.values()).sort((left, right) => left.day.localeCompare(right.day));
}

function createTrendBucket(day: string): DailyLeadTrendRow {
  return {
    day,
    label: formatTrendLabel(day),
    scanned: 0,
    semanticMatches: 0,
    strongLeads: 0,
    notStrongLeads: 0,
    pendingClassifications: 0,
    classificationFailures: 0,
  };
}

function getCalendarDayDistance(fromKey: string, toKey: string) {
  return Math.round(
    (new Date(`${toKey}T00:00:00.000Z`).getTime() - new Date(`${fromKey}T00:00:00.000Z`).getTime())
      / (24 * 60 * 60 * 1000),
  );
}

function formatTrendLabel(day: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00.000Z`));
}
