import { notFound, redirect } from "next/navigation";

import { SubredditAnalyticsReport } from "@/components/campaigns/subreddit-analytics-report";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import {
  buildAccessibleCampaignWhere,
  getCampaignAccessFromRecord,
  getCampaignDisplayName,
} from "@/lib/campaign-access";
import {
  buildSubredditRows,
  MIN_VISIBLE_LEAD_SCORE,
  summarizeSubredditRows,
} from "@/lib/subreddit-analytics";
import { prisma } from "@/lib/prisma";
import { reconcileCampaignSyncState } from "@/worker/sync-reconcile";

export default async function CampaignAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!canViewAnalytics(session.user.email)) {
    notFound();
  }

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: buildAccessibleCampaignWhere({
      campaignId: id,
      email: session.user.email,
      userId: session.user.id,
    }),
    select: {
      id: true,
      userId: true,
      name: true,
      description: true,
      subreddits: true,
      clientAccesses: {
        where: {
          normalizedEmail: String(session.user.email ?? "").trim().toLowerCase(),
        },
        select: {
          displayName: true,
          normalizedEmail: true,
        },
      },
      leads: {
        where: {
          ai: {
            isNot: null,
          },
          score: {
            gte: MIN_VISIBLE_LEAD_SCORE,
          },
        },
        select: {
          score: true,
          label: true,
          createdAt: true,
          redditItem: {
            select: {
              subreddit: true,
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const access = getCampaignAccessFromRecord({
    campaign,
    email: session.user.email,
    userId: session.user.id,
  });

  if (!access) {
    notFound();
  }

  const sync = await reconcileCampaignSyncState(campaign.id);
  const rows = buildSubredditRows(campaign.subreddits, campaign.leads);
  const summary = summarizeSubredditRows(rows);
  const displayName = getCampaignDisplayName(campaign, access);

  return (
    <SubredditAnalyticsReport
      backHref={`/campaigns/${campaign.id}`}
      backLabel="Back to campaign"
      badges={[
        {
          label: sync?.status ?? "IDLE",
          tone: sync?.status === "COMPLETED" ? "good" : "neutral",
        },
        {
          label: `${campaign.subreddits.length} tracked subreddits`,
          tone: "neutral",
        },
        ...(summary.topSubreddit
          ? [
              {
                label: `Top: r/${summary.topSubreddit.subreddit}`,
                tone: "good" as const,
              },
            ]
          : []),
      ]}
      description={campaign.description || "Subreddit-level lead distribution for this campaign."}
      eyebrow="Campaign analytics"
      rows={rows}
      summary={summary}
      title={displayName}
    />
  );
}
