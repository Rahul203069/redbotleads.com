"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import {
  normalizeSubredditName,
  setSubredditDailyRssPollingEnabled,
  type SubredditDailyRssPollingState,
} from "@/lib/subreddit-polling-settings";
import { removePendingRssFetchJobsForSubreddit } from "@/worker/queues";

export type RemoveSubredditFromCombinedReportResult = {
  status: "success" | "error";
  message: string;
  removedCampaigns?: number;
};

export type SetSubredditDailyRssPollingResult = {
  status: "success" | "error";
  message: string;
  removedPendingJobs?: number;
  state?: SubredditDailyRssPollingState;
};

export async function removeSubredditFromCombinedReport(
  formData: FormData,
): Promise<RemoveSubredditFromCombinedReportResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to update subreddit targeting.",
    };
  }

  if (!canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to update subreddit targeting.",
    };
  }

  const reportName = String(formData.get("reportName") ?? "").trim();
  const subreddit = normalizeSubredditName(String(formData.get("subreddit") ?? ""));

  if (!reportName || !subreddit) {
    return {
      status: "error",
      message: "Report name and subreddit are required.",
    };
  }

  const campaigns = await prisma.campaign.findMany({
    where: {
      name: {
        contains: reportName,
        mode: "insensitive",
      },
      subreddits: {
        has: subreddit,
      },
    },
    select: {
      id: true,
      subreddits: true,
    },
  });

  if (campaigns.length === 0) {
    return {
      status: "error",
      message: `r/${subreddit} is no longer tracked by campaigns in this report.`,
    };
  }

  await prisma.$transaction(
    campaigns.map((campaign) =>
      prisma.campaign.update({
        where: {
          id: campaign.id,
        },
        data: {
          subreddits: campaign.subreddits.filter((item) => normalizeSubredditName(item) !== subreddit),
        },
      }),
    ),
  );

  revalidatePath("/admin/analytics");
  revalidatePath(`/admin/analytics/subreddit-performance?name=${encodeURIComponent(reportName)}`);
  for (const campaign of campaigns) {
    revalidatePath(`/campaigns/${campaign.id}`);
    revalidatePath(`/campaigns/${campaign.id}/analytics`);
  }

  return {
    status: "success",
    message: `Removed r/${subreddit} from ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}.`,
    removedCampaigns: campaigns.length,
  };
}

export async function setSubredditDailyRssPollingState(
  formData: FormData,
): Promise<SetSubredditDailyRssPollingResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "You must be signed in to update subreddit polling.",
    };
  }

  if (!canViewAnalytics(session.user.email)) {
    return {
      status: "error",
      message: "You do not have permission to update subreddit polling.",
    };
  }

  const reportName = String(formData.get("reportName") ?? "").trim();
  const subreddit = normalizeSubredditName(String(formData.get("subreddit") ?? ""));
  const enabled = String(formData.get("enabled") ?? "") === "true";

  if (!subreddit) {
    return {
      status: "error",
      message: "Subreddit is required.",
    };
  }

  try {
    const state = await setSubredditDailyRssPollingEnabled({
      changedBy: session.user.email ?? session.user.id,
      enabled,
      subreddit,
    });
    let removedPendingJobs = 0;
    let cleanupFailed = false;

    if (!enabled) {
      const cleanup = await removePendingRssFetchJobsForSubreddit(subreddit);
      removedPendingJobs = cleanup.removed;
      cleanupFailed = cleanup.failed > 0;
    }

    revalidatePath("/admin/analytics");
    revalidatePath("/admin/analytics/subreddit-performance");

    if (reportName) {
      revalidatePath(`/admin/analytics/subreddit-performance?name=${encodeURIComponent(reportName)}`);
    }

    return {
      status: "success",
      message: enabled
        ? `Enabled daily RSS polling for r/${subreddit}.`
        : cleanupFailed
          ? `Disabled daily RSS polling for r/${subreddit}. Removed ${removedPendingJobs} pending fetch job${removedPendingJobs === 1 ? "" : "s"}; some pending jobs could not be removed.`
          : `Disabled daily RSS polling for r/${subreddit}. Removed ${removedPendingJobs} pending fetch job${removedPendingJobs === 1 ? "" : "s"}.`,
      removedPendingJobs,
      state,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `Subreddit polling update failed: ${error.message}` : "Subreddit polling update failed.",
    };
  }
}
