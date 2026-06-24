import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  CampaignSubredditAnalyticsCharts,
  type SubredditAnalyticsChartRow,
} from "@/components/campaigns/campaign-subreddit-analytics-charts";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reconcileCampaignSyncState } from "@/worker/sync-reconcile";

const MIN_VISIBLE_LEAD_SCORE = 40;

type SubredditAnalyticsRow = SubredditAnalyticsChartRow & {
  averageScore: number | null;
  latestLeadAt: Date | null;
  shareOfLeads: number;
  status: "Strong" | "Useful" | "Quiet";
};

export default async function CampaignAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      subreddits: true,
      updatedAt: true,
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
          id: true,
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

  const sync = await reconcileCampaignSyncState(campaign.id);
  const rows = buildSubredditRows(campaign.subreddits, campaign.leads);
  const totalLeads = rows.reduce((sum, row) => sum + row.totalLeads, 0);
  const highIntentLeads = rows.reduce((sum, row) => sum + row.highLeads, 0);
  const zeroLeadSubreddits = rows.filter((row) => row.totalLeads === 0).length;
  const topSubreddit = rows.find((row) => row.totalLeads > 0) ?? null;
  const averageScore =
    totalLeads > 0
      ? Math.round(
          rows.reduce((sum, row) => sum + (row.averageScore ?? 0) * row.totalLeads, 0) / totalLeads,
        )
      : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">
              Campaign analytics
            </p>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.6rem]">
              {campaign.name}
            </h1>
            <p className="mt-3 max-w-[68ch] text-[15px] leading-6 text-[#cbcbcb]">
              {campaign.description || "Subreddit-level lead distribution for this campaign."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusChip label={sync?.status ?? "IDLE"} tone={sync?.status === "COMPLETED" ? "good" : "neutral"} />
              <StatusChip label={`${campaign.subreddits.length} tracked subreddits`} tone="neutral" />
              {topSubreddit ? <StatusChip label={`Top: r/${topSubreddit.subreddit}`} tone="good" /> : null}
            </div>
          </div>
          <Link className="w-full sm:w-auto" href={`/campaigns/${campaign.id}`}>
            <Button
              className="w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] sm:w-auto"
              variant="secondary"
            >
              Back to campaign
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total leads" value={String(totalLeads)} />
        <MetricCard label="High intent" value={String(highIntentLeads)} />
        <MetricCard label="Average score" value={averageScore === null ? "-" : String(averageScore)} />
        <MetricCard label="Active subreddits" value={String(rows.length - zeroLeadSubreddits)} />
        <MetricCard label="Zero lead" value={String(zeroLeadSubreddits)} />
      </section>

      <CampaignSubredditAnalyticsCharts rows={rows} />

      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <div className="flex flex-col gap-2 border-b border-white/8 pb-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b3b3b3]">
            Subreddit ranking
          </p>
          <p className="text-[15px] leading-6 text-[#cbcbcb]">
            Ranked by classified lead volume, then high-intent count and average score.
          </p>
        </div>

        <div className="overflow-x-auto pt-4">
          <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                <th className="px-4 py-2">Subreddit</th>
                <th className="px-4 py-2">Leads</th>
                <th className="px-4 py-2">High</th>
                <th className="px-4 py-2">Medium</th>
                <th className="px-4 py-2">Low</th>
                <th className="px-4 py-2">Avg score</th>
                <th className="px-4 py-2">Share</th>
                <th className="px-4 py-2">Latest lead</th>
                <th className="px-4 py-2">Signal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="bg-[#1f1f1f] text-[14px] text-[#fdfdfd]" key={row.subreddit}>
                  <td className="rounded-l-[16px] px-4 py-4 font-semibold">r/{row.subreddit}</td>
                  <td className="px-4 py-4 tabular-nums">{row.totalLeads}</td>
                  <td className="px-4 py-4 tabular-nums text-[#1ed760]">{row.highLeads}</td>
                  <td className="px-4 py-4 tabular-nums text-[#f2c94c]">{row.medLeads}</td>
                  <td className="px-4 py-4 tabular-nums text-[#f3727f]">{row.lowLeads}</td>
                  <td className="px-4 py-4 tabular-nums">{row.averageScore ?? "-"}</td>
                  <td className="px-4 py-4 tabular-nums">{formatPercent(row.shareOfLeads)}</td>
                  <td className="px-4 py-4 text-[#cbcbcb]">{formatDate(row.latestLeadAt)}</td>
                  <td className="rounded-r-[16px] px-4 py-4">
                    <StatusChip label={row.status} tone={row.status === "Strong" ? "good" : row.status === "Quiet" ? "muted" : "neutral"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function buildSubredditRows(
  subreddits: string[],
  leads: Array<{
    score: number;
    label: "HIGH" | "MED" | "LOW";
    createdAt: Date;
    redditItem: {
      subreddit: string;
    };
  }>,
): SubredditAnalyticsRow[] {
  const trackedSubreddits = Array.from(new Set(subreddits.map(normalizeSubreddit).filter(Boolean)));
  const rows = new Map<string, {
    totalLeads: number;
    highLeads: number;
    medLeads: number;
    lowLeads: number;
    scoreTotal: number;
    latestLeadAt: Date | null;
  }>();

  for (const subreddit of trackedSubreddits) {
    rows.set(subreddit, {
      totalLeads: 0,
      highLeads: 0,
      medLeads: 0,
      lowLeads: 0,
      scoreTotal: 0,
      latestLeadAt: null,
    });
  }

  for (const lead of leads) {
    const subreddit = normalizeSubreddit(lead.redditItem.subreddit);

    if (!subreddit) {
      continue;
    }

    const row = rows.get(subreddit) ?? {
      totalLeads: 0,
      highLeads: 0,
      medLeads: 0,
      lowLeads: 0,
      scoreTotal: 0,
      latestLeadAt: null,
    };

    row.totalLeads += 1;
    row.scoreTotal += lead.score;
    row.highLeads += lead.label === "HIGH" ? 1 : 0;
    row.medLeads += lead.label === "MED" ? 1 : 0;
    row.lowLeads += lead.label === "LOW" ? 1 : 0;
    row.latestLeadAt =
      !row.latestLeadAt || lead.createdAt.getTime() > row.latestLeadAt.getTime()
        ? lead.createdAt
        : row.latestLeadAt;

    rows.set(subreddit, row);
  }

  const totalLeads = Array.from(rows.values()).reduce((sum, row) => sum + row.totalLeads, 0);

  return Array.from(rows.entries())
    .map(([subreddit, row]) => ({
      subreddit,
      totalLeads: row.totalLeads,
      highLeads: row.highLeads,
      medLeads: row.medLeads,
      lowLeads: row.lowLeads,
      averageScore: row.totalLeads > 0 ? Math.round(row.scoreTotal / row.totalLeads) : null,
      latestLeadAt: row.latestLeadAt,
      shareOfLeads: totalLeads > 0 ? row.totalLeads / totalLeads : 0,
      status: getSubredditStatus(row.totalLeads, row.highLeads),
    }))
    .sort((left, right) =>
      right.totalLeads - left.totalLeads ||
      right.highLeads - left.highLeads ||
      (right.averageScore ?? 0) - (left.averageScore ?? 0) ||
      left.subreddit.localeCompare(right.subreddit),
    );
}

function getSubredditStatus(totalLeads: number, highLeads: number): SubredditAnalyticsRow["status"] {
  if (highLeads > 0) {
    return "Strong";
  }

  if (totalLeads > 0) {
    return "Useful";
  }

  return "Quiet";
}

function normalizeSubreddit(value: string) {
  return value.trim().toLowerCase().replace(/^r\//, "");
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-[#181818] px-5 py-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">{label}</p>
      <p className="mt-3 text-[2rem] font-bold leading-none tracking-[-0.05em] text-[#ffffff]">{value}</p>
    </div>
  );
}

function StatusChip({ label, tone }: { label: string; tone: "good" | "neutral" | "muted" }) {
  const className =
    tone === "good"
      ? "bg-[#121212] text-[#1ed760]"
      : tone === "muted"
        ? "bg-[#121212] text-[#b3b3b3]"
        : "bg-[#121212] text-[#fdfdfd]";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${className}`}>
      {label}
    </span>
  );
}

function formatDate(value: Date | null) {
  if (!value) {
    return "No leads";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(value);
}
