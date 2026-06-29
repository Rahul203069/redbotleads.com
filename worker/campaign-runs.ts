import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";

type RunTrigger = "CAMPAIGN_CREATED" | "MANUAL_RESYNC" | "DAILY_SYNC" | "RSS_POLL_MATCH" | "DAILY_SEMANTIC";
type RunStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function createCampaignRun({
  campaignId,
  cronRunId,
  message,
  trigger,
}: {
  campaignId: string;
  cronRunId?: string | null;
  message: string;
  trigger: RunTrigger;
}) {
  const campaign = await prisma.campaign.findUnique({
    where: {
      id: campaignId,
    },
    select: {
      userId: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found for run tracking.");
  }

  return prisma.campaignRun.create({
    data: {
      campaignId,
      cronRunId: cronRunId || null,
      userId: campaign.userId,
      trigger,
      status: "QUEUED",
      message,
    },
    select: {
      id: true,
    },
  });
}

export async function markCampaignRunProcessing(campaignRunId: string | null | undefined, message: string, stats?: unknown) {
  return updateCampaignRun(campaignRunId, {
    status: "PROCESSING",
    message,
    startedAt: new Date(),
    statsJson: stats,
  });
}

export async function markCampaignRunCompleted(campaignRunId: string | null | undefined, message: string, stats?: unknown) {
  return updateCampaignRun(campaignRunId, {
    status: "COMPLETED",
    message,
    completedAt: new Date(),
    statsJson: stats,
  });
}

export async function markCampaignRunFailed(campaignRunId: string | null | undefined, error: string, stats?: unknown) {
  return updateCampaignRun(campaignRunId, {
    status: "FAILED",
    message: error,
    error,
    failedAt: new Date(),
    statsJson: stats,
  });
}

export async function refreshDailySemanticCampaignRunStats(campaignRunId: string | null | undefined) {
  if (!campaignRunId) {
    return null;
  }

  const run = await prisma.campaignRun.findUnique({
    where: {
      id: campaignRunId,
    },
    select: {
      campaignId: true,
      statsJson: true,
    },
  });

  if (!run) {
    return null;
  }

  const [matchedScans, noMatchScans, leads] = await Promise.all([
    prisma.campaignDailySemanticScan.count({
      where: {
        campaignRunId,
        status: "MATCHED",
      },
    }),
    prisma.campaignDailySemanticScan.count({
      where: {
        campaignRunId,
        status: "NO_MATCH",
      },
    }),
    prisma.lead.findMany({
      where: {
        campaignId: run.campaignId,
        redditItem: {
          dailySemanticScans: {
            some: {
              campaignRunId,
              status: "MATCHED",
            },
          },
        },
      },
      select: {
        score: true,
        ai: {
          select: {
            id: true,
          },
        },
      },
    }),
  ]);

  const classifiedLeads = leads.filter((lead) => lead.ai !== null);
  const stats = {
    matchedPosts: matchedScans,
    noMatchPosts: noMatchScans,
    scannedPosts: matchedScans + noMatchScans,
    totalLeadsFound: matchedScans,
    classifiedLeads: classifiedLeads.length,
    strongLeads: classifiedLeads.filter((lead) => lead.score > 75).length,
    notStrongLeads: classifiedLeads.filter((lead) => lead.score <= 75).length,
    pendingClassifications: leads.length - classifiedLeads.length,
  };

  return updateCampaignRun(campaignRunId, {
    status: leads.length > classifiedLeads.length ? "PROCESSING" : "COMPLETED",
    message:
      leads.length > classifiedLeads.length
        ? "Daily semantic leads are waiting for AI scoring."
        : "Daily semantic search and scoring complete.",
    completedAt: leads.length > classifiedLeads.length ? undefined : new Date(),
    statsJson: stats,
  });
}

async function updateCampaignRun(
  campaignRunId: string | null | undefined,
  data: {
    status: RunStatus;
    message: string;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    statsJson?: unknown;
  },
) {
  if (!campaignRunId) {
    return null;
  }

  try {
    const existing = data.statsJson === undefined
      ? null
      : await prisma.campaignRun.findUnique({
          where: {
            id: campaignRunId,
          },
          select: {
            statsJson: true,
          },
        });
    const statsJson =
      data.statsJson === undefined
        ? undefined
        : ({
            ...(isJsonObject(existing?.statsJson) ? existing.statsJson : {}),
            ...(isJsonObject(data.statsJson) ? data.statsJson : {}),
          } as Prisma.InputJsonValue);

    return await prisma.campaignRun.update({
      where: {
        id: campaignRunId,
      },
      data: {
        status: data.status,
        message: data.message,
        error: data.error,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        failedAt: data.failedAt,
        statsJson,
      },
    });
  } catch {
    return null;
  }
}
