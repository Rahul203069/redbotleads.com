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

export type ClientActivityTrendRow = {
  dashboardVisits: number;
  day: string;
  label: string;
  leadReviews: number;
};

export function ClientActivityTrendChart({ rows }: { rows: ClientActivityTrendRow[] }) {
  const totals = rows.reduce(
    (sum, row) => ({
      dashboardVisits: sum.dashboardVisits + row.dashboardVisits,
      leadReviews: sum.leadReviews + row.leadReviews,
    }),
    {
      dashboardVisits: 0,
      leadReviews: 0,
    },
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-[18px] bg-[#121212] px-4 py-6 text-[14px] leading-6 text-[#b3b3b3]">
        No recorded activity in this date range.
      </div>
    );
  }

  return (
    <div
      aria-label={`Activity trend with ${totals.dashboardVisits} dashboard visits and ${totals.leadReviews} lead-review actions.`}
      className="rounded-[20px] bg-[#101010] px-2 pb-3 pt-5 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:px-4"
      role="img"
    >
      <div className="px-3 pb-3">
        <p className="text-[13px] font-semibold text-[#ffffff]">Daily engagement</p>
        <p className="mt-1 text-[12px] text-[#8f8f8f]">Dashboard access versus direct lead-review actions.</p>
      </div>
      <div className="h-[300px] sm:h-[360px]">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={rows} margin={{ bottom: 8, left: -12, right: 12, top: 16 }}>
            <CartesianGrid stroke="#292929" strokeDasharray="3 5" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              minTickGap={18}
              tick={{ fill: "#b3b3b3", fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tick={{ fill: "#8f8f8f", fontSize: 11 }}
              tickLine={false}
              width={34}
            />
            <Tooltip
              contentStyle={{
                background: "#121212",
                border: "1px solid #303030",
                borderRadius: 14,
                color: "#ffffff",
              }}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            <Legend wrapperStyle={{ color: "#cbcbcb", fontSize: 12, paddingTop: 12 }} />
            <Bar dataKey="dashboardVisits" fill="#58a6ff" name="Dashboard visits" radius={[5, 5, 0, 0]} />
            <Bar dataKey="leadReviews" fill="#1ed760" name="Lead reviews" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
