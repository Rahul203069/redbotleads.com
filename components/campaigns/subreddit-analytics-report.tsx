import Link from "next/link";

import { CampaignSubredditAnalyticsCharts } from "@/components/campaigns/campaign-subreddit-analytics-charts";
import { Button } from "@/components/ui/button";
import {
  type SubredditAnalyticsRow,
  type SubredditAnalyticsSummary,
} from "@/lib/subreddit-analytics";

type MatchedCampaignSummary = {
  id: string;
  name: string;
  subreddits: string[];
  leadsCount: number;
};

export function SubredditAnalyticsReport({
  backHref,
  backLabel,
  badges,
  description,
  matchedCampaigns,
  rows,
  summary,
  eyebrow,
  title,
}: {
  backHref: string;
  backLabel: string;
  badges: Array<{ label: string; tone: "good" | "neutral" | "muted" }>;
  description: string;
  matchedCampaigns?: MatchedCampaignSummary[];
  rows: SubredditAnalyticsRow[];
  summary: SubredditAnalyticsSummary;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.6rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-[68ch] text-[15px] leading-6 text-[#cbcbcb]">{description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <StatusChip key={badge.label} label={badge.label} tone={badge.tone} />
              ))}
            </div>
          </div>
          <Link className="w-full sm:w-auto" href={backHref}>
            <Button
              className="w-full rounded-full border-none bg-[#1f1f1f] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#252525] sm:w-auto"
              variant="secondary"
            >
              {backLabel}
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total leads" value={String(summary.totalLeads)} />
        <MetricCard label="High intent" value={String(summary.highIntentLeads)} />
        <MetricCard label="Average score" value={summary.averageScore === null ? "-" : String(summary.averageScore)} />
        <MetricCard label="Active subreddits" value={String(summary.activeSubreddits)} />
        <MetricCard label="Zero lead" value={String(summary.zeroLeadSubreddits)} />
      </section>

      {matchedCampaigns ? <MatchedCampaignsPanel campaigns={matchedCampaigns} /> : null}

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
                    <StatusChip
                      label={row.status}
                      tone={row.status === "Strong" ? "good" : row.status === "Quiet" ? "muted" : "neutral"}
                    />
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

function MatchedCampaignsPanel({ campaigns }: { campaigns: MatchedCampaignSummary[] }) {
  return (
    <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
      <div className="flex flex-col gap-2 border-b border-white/8 pb-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b3b3b3]">
          Matched campaigns
        </p>
        <p className="text-[15px] leading-6 text-[#cbcbcb]">
          Campaigns included in this combined subreddit performance report.
        </p>
      </div>
      <div className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((campaign) => (
          <Link
            className="rounded-[18px] bg-[#121212] p-4 text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#1f1f1f]"
            href={`/campaigns/${campaign.id}`}
            key={campaign.id}
          >
            <p className="truncate text-[14px] font-bold">{campaign.name}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusChip label={`${campaign.leadsCount} leads`} tone={campaign.leadsCount > 0 ? "good" : "muted"} />
              <StatusChip label={`${campaign.subreddits.length} subreddits`} tone="neutral" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
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
