"use server";

import { revalidatePath } from "next/cache";

import { completeCronRun, createCronRun, failCronRun } from "@/lib/cron-runs";
import {
  pauseDailyRssPoller,
  resumeDailyRssPoller,
  type DailyRssPollerPauseState,
} from "@/lib/daily-rss-poller-control";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { enqueueDailySemanticCampaigns } from "@/lib/daily-semantic";
import { prisma } from "@/lib/prisma";
import { classificationQueue } from "@/worker/queues";

const DAILY_SEMANTIC_CRON_PATH = "/api/cron/daily-semantic";
const CLASSIFICATION_ERROR_MODEL = "classification-error";
const UNSUPPORTED_TEMPERATURE_ERROR_TEXT = "Unsupported value: 'temperature'";

export type DailyRssPollerControlResult = {
  status: "success" | "error";
  message: string;
  state?: DailyRssPollerPauseState;
};

export type CampaignActiveToggleResult = {
  status: "success" | "error";
  message: string;
  isActive?: boolean;
};

export type ManualDailySemanticResult = {
  status: "success" | "error";
  message: string;
  cronRunId?: string;
  queued?: number;
  skipped?: number;
  failed?: number;
};

export type RetryFailedDailySemanticResult = {
  status: "success" | "error";
  message: string;
  queued?: number;
  failed?: number;
};

export async function runDailySemanticOverride(): Promise<ManualDailySemanticResult> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to run daily semantic filtering.",
    };
  }

  const cronRun = await createCronRun(DAILY_SEMANTIC_CRON_PATH);

  try {
    const result = await enqueueDailySemanticCampaigns({
      cronRunId: cronRun.id,
    });

    const message = `Daily semantic override queued ${result.queued} campaign${result.queued === 1 ? "" : "s"}.`;
    await completeCronRun(cronRun.id, message, result);

    revalidatePath("/admin/analytics");
    revalidatePath("/admin/analytics/daily-leads");

    return {
      status: "success",
      message,
      cronRunId: cronRun.id,
      queued: result.queued,
      skipped: result.skipped,
      failed: result.failed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily semantic override failed.";
    await failCronRun(cronRun.id, message);

    return {
      status: "error",
      message: `Daily semantic override failed: ${message}`,
      cronRunId: cronRun.id,
    };
  }
}

export async function retryFailedDailySemanticClassifications(input: {
  campaignId?: string | null;
  from: string;
  to: string;
}): Promise<RetryFailedDailySemanticResult> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to retry failed classifications.",
    };
  }

  const from = new Date(input.from);
  const to = new Date(input.to);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return {
      status: "error",
      message: "Invalid daily semantic log date range.",
    };
  }

  const scans = await prisma.campaignDailySemanticScan.findMany({
    where: {
      status: "MATCHED",
      updatedAt: {
        gte: from,
        lt: to,
      },
      ...(input.campaignId
        ? {
            campaignId: input.campaignId,
          }
        : {}),
      redditItem: {
        leads: {
          some: {
            campaignId: input.campaignId ? input.campaignId : undefined,
            ai: {
              model: CLASSIFICATION_ERROR_MODEL,
              summary: {
                contains: UNSUPPORTED_TEMPERATURE_ERROR_TEXT,
              },
            },
          },
        },
      },
    },
    select: {
      campaignId: true,
      campaignRunId: true,
      redditItemId: true,
      redditItem: {
        select: {
          leads: {
            where: {
              campaignId: input.campaignId ? input.campaignId : undefined,
              ai: {
                model: CLASSIFICATION_ERROR_MODEL,
                summary: {
                  contains: UNSUPPORTED_TEMPERATURE_ERROR_TEXT,
                },
              },
            },
            select: {
              id: true,
              campaignId: true,
            },
          },
        },
      },
    },
    take: 500,
  });

  const retryItems = scans.flatMap((scan) =>
    scan.redditItem.leads
      .filter((lead) => lead.campaignId === scan.campaignId)
      .map((lead) => ({
        campaignId: scan.campaignId,
        campaignRunId: scan.campaignRunId,
        leadId: lead.id,
      })),
  );

  if (retryItems.length === 0) {
    return {
      status: "success",
      message: "No temperature-related classification failures matched this view.",
      queued: 0,
      failed: 0,
    };
  }

  const results = await Promise.allSettled(
    retryItems.map((item) => {
      const retryId = `classify--daily-semantic-retry--${item.leadId}--${Date.now()}`;

      return classificationQueue.add(
        "CLASSIFY_LEAD",
        {
          leadId: item.leadId,
          campaignId: item.campaignId,
          campaignRunId: item.campaignRunId ?? undefined,
          trigger: "daily_semantic",
        },
        {
          jobId: retryId,
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      );
    }),
  );
  const queued = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - queued;

  revalidatePath("/admin/analytics/daily-leads");
  if (input.campaignId) {
    revalidatePath(`/campaigns/${input.campaignId}/daily-leads`);
  }

  return {
    status: failed > 0 ? "error" : "success",
    message:
      failed > 0
        ? `Queued ${queued} failed classification retr${queued === 1 ? "y" : "ies"}; ${failed} could not be queued.`
        : `Queued ${queued} failed classification retr${queued === 1 ? "y" : "ies"}.`,
    queued,
    failed,
  };
}

export async function pauseDailySubredditIngestion(): Promise<DailyRssPollerControlResult> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to pause daily RSS ingestion.",
    };
  }

  const pausedAt = new Date();
  const pausedBy = session.user.email ?? session.user.id;

  try {
    await pauseDailyRssPoller({
      pausedAt,
      pausedBy,
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `Pause failed: ${error.message}` : "Pause failed.",
    };
  }

  revalidatePath("/admin/analytics");

  return {
    status: "success",
    message: "Daily subreddit RSS ingestion paused.",
    state: {
      paused: true,
      pausedAt: pausedAt.toISOString(),
      pausedBy,
    },
  };
}

export async function resumeDailySubredditIngestion(): Promise<DailyRssPollerControlResult> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to resume daily RSS ingestion.",
    };
  }

  try {
    await resumeDailyRssPoller();
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `Resume failed: ${error.message}` : "Resume failed.",
    };
  }

  revalidatePath("/admin/analytics");

  return {
    status: "success",
    message: "Daily subreddit RSS ingestion resumed.",
    state: {
      paused: false,
      pausedAt: null,
      pausedBy: null,
    },
  };
}

export async function setAdminCampaignActiveState(formData: FormData): Promise<CampaignActiveToggleResult> {
  const session = await auth();

  if (!session?.user?.id || !canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to update campaign status.",
    };
  }

  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!campaignId) {
    return {
      status: "error",
      message: "Campaign ID is missing.",
    };
  }

  try {
    const campaign = await prisma.campaign.update({
      where: {
        id: campaignId,
      },
      data: {
        isActive,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    revalidatePath("/admin/analytics");
    revalidatePath(`/campaigns/${campaign.id}`);
    revalidatePath(`/campaigns/${campaign.id}/analytics`);

    return {
      status: "success",
      message: campaign.isActive
        ? "Campaign activated. Daily RSS and daily semantic search can include it again."
        : "Campaign paused. Daily RSS and daily semantic search will skip it.",
      isActive: campaign.isActive,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `Campaign status update failed: ${error.message}` : "Campaign status update failed.",
    };
  }
}
