import type { SubredditAnalyticsChartRow } from "@/components/campaigns/campaign-subreddit-analytics-charts";

export const MIN_VISIBLE_LEAD_SCORE = 40;

export type SubredditAnalyticsLead = {
  score: number;
  label: "HIGH" | "MED" | "LOW";
  createdAt: Date;
  redditItem: {
    subreddit: string;
  };
};

export type SubredditAnalyticsRow = SubredditAnalyticsChartRow & {
  averageScore: number | null;
  latestLeadAt: Date | null;
  shareOfLeads: number;
  status: "Strong" | "Useful" | "Quiet";
};

export type SubredditAnalyticsSummary = {
  totalLeads: number;
  highIntentLeads: number;
  zeroLeadSubreddits: number;
  activeSubreddits: number;
  averageScore: number | null;
  topSubreddit: SubredditAnalyticsRow | null;
};

export function buildSubredditRows(
  subreddits: string[],
  leads: SubredditAnalyticsLead[],
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

export function summarizeSubredditRows(rows: SubredditAnalyticsRow[]): SubredditAnalyticsSummary {
  const totalLeads = rows.reduce((sum, row) => sum + row.totalLeads, 0);
  const highIntentLeads = rows.reduce((sum, row) => sum + row.highLeads, 0);
  const zeroLeadSubreddits = rows.filter((row) => row.totalLeads === 0).length;

  return {
    totalLeads,
    highIntentLeads,
    zeroLeadSubreddits,
    activeSubreddits: rows.length - zeroLeadSubreddits,
    averageScore:
      totalLeads > 0
        ? Math.round(rows.reduce((sum, row) => sum + (row.averageScore ?? 0) * row.totalLeads, 0) / totalLeads)
        : null,
    topSubreddit: rows.find((row) => row.totalLeads > 0) ?? null,
  };
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
