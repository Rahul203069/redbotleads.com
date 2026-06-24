"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SubredditAnalyticsChartRow = {
  subreddit: string;
  totalLeads: number;
  highLeads: number;
  medLeads: number;
  lowLeads: number;
};

export function CampaignSubredditAnalyticsCharts({
  rows,
}: {
  rows: SubredditAnalyticsChartRow[];
}) {
  const chartRows = rows
    .filter((row) => row.totalLeads > 0)
    .slice(0, 12)
    .map((row) => ({
      ...row,
      label: `r/${row.subreddit}`,
    }));

  if (chartRows.length === 0) {
    return (
      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <div className="border-b border-white/8 pb-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b3b3b3]">
            Distribution
          </p>
          <h2 className="mt-2 text-[24px] font-bold tracking-[-0.04em] text-[#ffffff]">
            No chartable leads yet
          </h2>
        </div>
        <p className="pt-5 text-[14px] leading-6 text-[#cbcbcb]">
          The campaign has tracked subreddits, but none produced classified leads yet.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <ChartShell
        description="Total classified leads from the strongest subreddits."
        title="Lead volume"
      >
        <ResponsiveContainer height={320} width="100%">
          <BarChart data={chartRows} margin={{ bottom: 22, left: -12, right: 10, top: 10 }}>
            <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
            <XAxis
              angle={-25}
              dataKey="label"
              height={70}
              interval={0}
              stroke="#b3b3b3"
              tick={{ fill: "#b3b3b3", fontSize: 11 }}
              textAnchor="end"
            />
            <YAxis allowDecimals={false} stroke="#b3b3b3" tick={{ fill: "#b3b3b3", fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="totalLeads" fill="#58a6ff" name="Total leads" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell
        description="Quality mix by subreddit, split by final lead label."
        title="Lead quality"
      >
        <ResponsiveContainer height={320} width="100%">
          <BarChart data={chartRows} margin={{ bottom: 22, left: -12, right: 10, top: 10 }}>
            <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
            <XAxis
              angle={-25}
              dataKey="label"
              height={70}
              interval={0}
              stroke="#b3b3b3"
              tick={{ fill: "#b3b3b3", fontSize: 11 }}
              textAnchor="end"
            />
            <YAxis allowDecimals={false} stroke="#b3b3b3" tick={{ fill: "#b3b3b3", fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Legend
              iconType="circle"
              wrapperStyle={{
                color: "#cbcbcb",
                fontSize: 12,
                paddingTop: 8,
              }}
            />
            <Bar dataKey="highLeads" fill="#1ed760" name="High" stackId="quality" />
            <Bar dataKey="medLeads" fill="#f2c94c" name="Medium" stackId="quality" />
            <Bar dataKey="lowLeads" fill="#f3727f" name="Low" radius={[8, 8, 0, 0]} stackId="quality" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
    </section>
  );
}

function ChartShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
      <div className="border-b border-white/8 pb-4">
        <h2 className="text-[24px] font-bold tracking-[-0.04em] text-[#ffffff]">{title}</h2>
        <p className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">{description}</p>
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{
    color?: string;
    name?: string;
    value?: number;
  }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-[16px] bg-[#121212] p-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <p className="text-[12px] font-semibold text-[#ffffff]">{label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div className="flex items-center gap-2 text-[12px] text-[#cbcbcb]" key={entry.name}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}</span>
            <span className="font-semibold text-[#ffffff]">{entry.value ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
