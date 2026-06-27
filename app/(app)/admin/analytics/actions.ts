"use server";

import { revalidatePath } from "next/cache";

import {
  pauseDailyRssPoller,
  resumeDailyRssPoller,
  type DailyRssPollerPauseState,
} from "@/lib/daily-rss-poller-control";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";

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
