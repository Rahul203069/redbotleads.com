"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";

export type RemoveSubredditFromCombinedReportResult = {
  status: "success" | "error";
  message: string;
  removedCampaigns?: number;
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

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}
