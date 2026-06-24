import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";

type RunTrigger = "CAMPAIGN_CREATED" | "MANUAL_RESYNC" | "DAILY_SYNC" | "RSS_POLL_MATCH";
type RunStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function createCampaignRun({
  campaignId,
  message,
  trigger,
}: {
  campaignId: string;
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
