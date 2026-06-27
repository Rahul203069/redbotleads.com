"use server";

import { revalidatePath } from "next/cache";

import {
  pauseDailyRssPoller,
  resumeDailyRssPoller,
  type DailyRssPollerPauseState,
} from "@/lib/daily-rss-poller-control";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";

export type DailyRssPollerControlResult = {
  status: "success" | "error";
  message: string;
  state?: DailyRssPollerPauseState;
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
