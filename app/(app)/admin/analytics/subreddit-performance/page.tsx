import { redirect } from "next/navigation";

import { SubredditAnalyticsReport } from "@/components/campaigns/subreddit-analytics-report";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import {
  buildSubredditRows,
  MIN_VISIBLE_LEAD_SCORE,
  summarizeSubredditRows,
} from "@/lib/subreddit-analytics";

type SearchParams = {
  name?: string;
};

export default async function AdminSubredditPerformancePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!canViewAnalytics(session.user.email)) {
    redirect("/app");
  }

  const params = await Promise.resolve(searchParams ?? {});
  const query = String(params.name ?? "").trim();

  if (!query) {
    return (
      <EmptyReportState
        description="Open this report from the admin analytics page and enter part of a campaign name."
        title="No campaign name entered"
      />
    );
  }

  const campaigns = await prisma.campaign.findMany({
    where: {
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      subreddits: true,
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
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (campaigns.length === 0) {
    return (
      <EmptyReportState
        description={`No campaigns matched "${query}". Try a shorter shared name fragment from the admin analytics page.`}
        title="No matching campaigns"
      />
    );
  }

  const rows = buildSubredditRows(
    campaigns.flatMap((campaign) => campaign.subreddits),
    campaigns.flatMap((campaign) => campaign.leads),
  );
  const summary = summarizeSubredditRows(rows);
  const affectedCampaignCounts = buildAffectedCampaignCounts(campaigns.map((campaign) => campaign.subreddits));

  return (
    <SubredditAnalyticsReport
      backHref="/admin/analytics"
      backLabel="Back to admin analytics"
      badges={[
        {
          label: `${campaigns.length} matched campaign${campaigns.length === 1 ? "" : "s"}`,
          tone: "neutral",
        },
        {
          label: `Search: ${query}`,
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
      description={`Combined subreddit performance for campaigns with names containing "${query}".`}
      deleteContext={{
        affectedCampaignCounts,
        reportName: query,
      }}
      eyebrow="Admin subreddit performance"
      matchedCampaigns={campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        subreddits: campaign.subreddits,
        leadsCount: campaign.leads.length,
      }))}
      rows={rows}
      summary={summary}
      title={`Subreddit performance: ${query}`}
    />
  );
}

function buildAffectedCampaignCounts(campaignSubredditLists: string[][]) {
  const counts: Record<string, number> = {};

  for (const subreddits of campaignSubredditLists) {
    const uniqueSubreddits = new Set(subreddits.map(normalizeSubredditName).filter(Boolean));

    for (const subreddit of uniqueSubreddits) {
      counts[subreddit] = (counts[subreddit] ?? 0) + 1;
    }
  }

  return counts;
}

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function EmptyReportState({ description, title }: { description: string; title: string }) {
  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">
          Admin subreddit performance
        </p>
        <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.6rem]">
          {title}
        </h1>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-6 text-[#cbcbcb]">{description}</p>
        <a
          className="mt-6 inline-flex rounded-full bg-[#1f1f1f] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525]"
          href="/admin/analytics"
        >
          Back to admin analytics
        </a>
      </section>
    </div>
  );
}
