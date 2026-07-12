"use client";

import {
  Area,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type WorkspaceLeadsTrendRow = {
  day: string;
  label: string;
  scanned: number;
  totalLeads: number;
  strongLeads: number;
};

export function WorkspaceLeadsTrendChart({ rows }: { rows: WorkspaceLeadsTrendRow[] }) {
  const totals = rows.reduce(
    (sum, row) => ({
      scanned: sum.scanned + row.scanned,
      strongLeads: sum.strongLeads + row.strongLeads,
      totalLeads: sum.totalLeads + row.totalLeads,
    }),
    {
      scanned: 0,
      strongLeads: 0,
      totalLeads: 0,
    },
  );
  const hasChartData = rows.some((row) => row.scanned > 0 || row.totalLeads > 0 || row.strongLeads > 0);
  const strongLeadRate = totals.totalLeads > 0 ? Math.round((totals.strongLeads / totals.totalLeads) * 100) : 0;
  const bestDay = rows.reduce<WorkspaceLeadsTrendRow | null>(
    (best, row) => (!best || row.totalLeads > best.totalLeads ? row : best),
    null,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TrendMetric detail="Reddit posts reviewed" label="Scanned" value={totals.scanned} />
        <TrendMetric detail="Matched in 14 days" label="Leads found" value={totals.totalLeads} tone="blue" />
        <TrendMetric detail="Score above 75" label="Strong leads" value={totals.strongLeads} tone="green" />
        <TrendMetric detail="Of all leads found" label="Strong lead rate" suffix="%" value={strongLeadRate} tone="green" />
      </div>

      {hasChartData ? (
        <div
          aria-label={`Daily lead fetch trend. ${totals.totalLeads} total leads and ${totals.strongLeads} strong leads in the last ${rows.length} days.`}
          className="rounded-[20px] bg-[#101010] px-2 pb-3 pt-5 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:px-4"
          role="img"
        >
          <div className="flex flex-col gap-1 px-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[#fdfdfd]">Daily lead activity</p>
              <p className="mt-1 text-[12px] text-[#8f8f8f]">Last {rows.length} days · UTC</p>
            </div>
            {bestDay && bestDay.totalLeads > 0 ? (
              <p className="text-[12px] text-[#b3b3b3]">
                Best day <span className="font-semibold text-[#ffffff]">{bestDay.label} · {bestDay.totalLeads} leads</span>
              </p>
            ) : null}
          </div>
          <div className="h-[340px] sm:h-[390px]">
            <ResponsiveContainer height="100%" width="100%">
              <ComposedChart data={rows} margin={{ bottom: 8, left: -12, right: 12, top: 16 }}>
                <defs>
                  <linearGradient id="totalLeadsFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#58a6ff" stopOpacity={0.36} />
                    <stop offset="100%" stopColor="#58a6ff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
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
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "rgba(255,255,255,0.16)", strokeDasharray: "4 4" }} />
                <Legend
                  iconType="plainline"
                  wrapperStyle={{ color: "#cbcbcb", fontSize: 12, paddingTop: 12 }}
                />
                <Area
                  dataKey="totalLeads"
                  fill="url(#totalLeadsFill)"
                  name="Leads found"
                  stroke="#58a6ff"
                  strokeWidth={3}
                  type="monotone"
                />
                <Line
                  activeDot={{ fill: "#1ed760", r: 5, stroke: "#101010", strokeWidth: 2 }}
                  dataKey="strongLeads"
                  dot={{ fill: "#1ed760", r: 3, stroke: "#101010", strokeWidth: 2 }}
                  name="Strong leads"
                  stroke="#1ed760"
                  strokeDasharray="7 5"
                  strokeWidth={3}
                  type="monotone"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="rounded-[18px] bg-[#121212] px-4 py-5 text-[14px] leading-6 text-[#b3b3b3]">
          No daily lead fetch activity in the last {rows.length} days.
        </div>
      )}
    </div>
  );
}

function TrendMetric({
  detail,
  label,
  suffix = "",
  tone = "neutral",
  value,
}: {
  detail: string;
  label: string;
  suffix?: string;
  tone?: "blue" | "green" | "neutral";
  value: number;
}) {
  const toneClass =
    tone === "green"
      ? "text-[#1ed760]"
      : tone === "blue"
        ? "text-[#58a6ff]"
        : "text-[#ffffff]";

  return (
    <div className="rounded-[16px] bg-[#121212] px-4 py-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">{label}</div>
      <div className={`mt-2 text-[24px] font-bold leading-none tracking-[-0.04em] ${toneClass}`}>{value}{suffix}</div>
      <div className="mt-2 text-[11px] text-[#8f8f8f]">{detail}</div>
    </div>
  );
}

function TrendTooltip({
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
    payload?: WorkspaceLeadsTrendRow;
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
        {row ? <div className="pt-1 text-[12px] text-[#8f8f8f]">Scanned: {row.scanned}</div> : null}
      </div>
    </div>
  );
}
