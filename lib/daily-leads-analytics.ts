import { prisma } from "@/lib/prisma";

export const DAILY_SEMANTIC_CRON_PATH = "/api/cron/daily-semantic";
export const DAILY_STRONG_LEAD_SCORE = 75;
export const DAILY_LEADS_LIMIT = 300;

export type DailyLeadDateRange = {
  from: Date;
  to: Date;
  source: "query" | "server";
};

export type DailyLeadAnalytics = Awaited<ReturnType<typeof getDailyLeadAnalytics>>;

export function getDailyLeadDateRange(input: {
  from?: string;
  to?: string;
}): DailyLeadDateRange {
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

export async function getDailyLeadAnalytics({
  campaignId,
  from,
  to,
  userId,
}: {
  campaignId?: string;
  from: Date;
  to: Date;
  userId?: string;
}) {
  const campaignWhere = {
    ...(campaignId ? { id: campaignId } : {}),
    ...(userId ? { userId } : {}),
  };
  const scanWhere = {
    updatedAt: {
      gte: from,
      lt: to,
    },
    ...(campaignId || userId
      ? {
          campaign: campaignWhere,
        }
      : {}),
  };
  const runWhere = {
    trigger: "DAILY_SEMANTIC",
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

  const [cronRuns, campaignRuns, scans] = await Promise.all([
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
      take: DAILY_LEADS_LIMIT,
    }),
  ]);

  const leadPairs = scans
    .filter((scan) => scan.status === "MATCHED")
    .map((scan) => ({
      campaignId: scan.campaignId,
      redditItemId: scan.redditItemId,
    }));
  const leads = leadPairs.length === 0
    ? []
    : await prisma.lead.findMany({
        where: {
          OR: leadPairs,
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
      });
  const leadByPair = new Map(leads.map((lead) => [buildPairKey(lead.campaignId, lead.redditItemId), lead]));

  const rows = scans.map((scan) => {
    const lead = leadByPair.get(buildPairKey(scan.campaignId, scan.redditItemId)) ?? null;
    const notification =
      lead?.notifications.find((item) => item.campaignRunId && item.campaignRunId === scan.campaignRunId)
      ?? lead?.notifications[0]
      ?? null;
    const classified = Boolean(lead?.ai);
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

  const matchedRows = rows.filter((row) => row.semanticStatus === "MATCHED");
  const classifiedRows = matchedRows.filter((row) => row.lead?.classified);

  return {
    cronRuns,
    campaignRuns,
    rows,
    metrics: {
      cronRuns: cronRuns.length,
      campaignsQueued: campaignRuns.length,
      candidatesScanned: rows.length,
      semanticMatches: matchedRows.length,
      totalLeadsFound: matchedRows.length,
      classifiedLeads: classifiedRows.length,
      strongLeads: classifiedRows.filter((row) => row.lead?.strong).length,
      notStrongLeads: classifiedRows.filter((row) => row.lead && !row.lead.strong).length,
      pendingClassifications: matchedRows.filter((row) => !row.lead?.classified).length,
      notificationsSent: rows.filter((row) => row.notification?.status === "SENT").length,
      notificationsFailed: rows.filter((row) => row.notification?.status === "FAILED").length,
    },
  };
}

function buildPairKey(campaignId: string, redditItemId: string) {
  return `${campaignId}:${redditItemId}`;
}
