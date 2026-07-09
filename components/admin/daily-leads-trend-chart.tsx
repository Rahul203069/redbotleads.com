"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyLeadTrendRow } from "@/lib/daily-leads-analytics";

export function DailyLeadsTrendChart({ rows }: { rows: DailyLeadTrendRow[] }) {
  const hasChartData = rows.some((row) => row.scanned > 0 || row.semanticMatches > 0);

  return (
    <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
      <div className="border-b border-white/8 pb-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b3b3b3]">Daily analytics</p>
        <h2 className="mt-2 text-[24px] font-bold tracking-[-0.04em] text-[#ffffff]">Lead trend</h2>
        <p className="mt-2 max-w-[72ch] text-[14px] leading-6 text-[#cbcbcb]">
          Daily semantic matches, strong leads, and scanned posts for the selected range.
        </p>
      </div>

      {hasChartData ? (
        <div className="pt-5">
          <ResponsiveContainer height={340} width="100%">
            <AreaChart data={rows} margin={{ bottom: 8, left: -12, right: 14, top: 12 }}>
              <defs>
                <linearGradient id="dailyLeadMatches" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#58a6ff" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="dailyStrongLeads" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#1ed760" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#1ed760" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                minTickGap={18}
                stroke="#b3b3b3"
                tick={{ fill: "#b3b3b3", fontSize: 11 }}
                tickLine={false}
              />
              <YAxis allowDecimals={false} stroke="#b3b3b3" tick={{ fill: "#b3b3b3", fontSize: 11 }} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.16)", strokeWidth: 1 }} />
              <Legend
                iconType="circle"
                wrapperStyle={{
                  color: "#cbcbcb",
                  fontSize: 12,
                  paddingTop: 10,
                }}
              />
              <Area
                activeDot={{ r: 5 }}
                dataKey="semanticMatches"
                fill="url(#dailyLeadMatches)"
                name="Total leads"
                stroke="#58a6ff"
                strokeWidth={2}
                type="monotone"
              />
              <Area
                activeDot={{ r: 5 }}
                dataKey="strongLeads"
                fill="url(#dailyStrongLeads)"
                name="Strong leads"
                stroke="#1ed760"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="pt-5 text-[14px] leading-6 text-[#cbcbcb]">
          No daily lead activity matched this date range yet.
        </div>
      )}
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
    dataKey?: string;
    name?: string;
    payload?: DailyLeadTrendRow;
    value?: number;
  }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0]?.payload;

  return (
    <div className="rounded-[16px] bg-[#121212] p-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <p className="text-[12px] font-semibold text-[#ffffff]">{label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div className="flex items-center gap-2 text-[12px] text-[#cbcbcb]" key={entry.dataKey ?? entry.name}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}</span>
            <span className="font-semibold text-[#ffffff]">{entry.value ?? 0}</span>
          </div>
        ))}
        {row ? (
          <>
            <div className="pt-1 text-[12px] text-[#8f8f8f]">Scanned: {row.scanned}</div>
            <div className="text-[12px] text-[#8f8f8f]">Pending AI: {row.pendingClassifications}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}
