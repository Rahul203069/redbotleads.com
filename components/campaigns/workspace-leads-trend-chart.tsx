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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <TrendMetric label="Scanned" value={totals.scanned} />
        <TrendMetric label="Total leads" value={totals.totalLeads} tone="blue" />
        <TrendMetric label="Strong leads" value={totals.strongLeads} tone="green" />
      </div>

      {hasChartData ? (
        <div
          aria-label={`Daily lead fetch trend. ${totals.totalLeads} total leads and ${totals.strongLeads} strong leads in the last ${rows.length} days.`}
          className="h-[300px] rounded-[18px] bg-[#101010] p-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
          role="img"
        >
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={rows} margin={{ bottom: 6, left: -14, right: 8, top: 12 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                minTickGap={14}
                stroke="#b3b3b3"
                tick={{ fill: "#b3b3b3", fontSize: 11 }}
                tickLine={false}
              />
              <YAxis allowDecimals={false} stroke="#b3b3b3" tick={{ fill: "#b3b3b3", fontSize: 11 }} tickLine={false} />
              <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(255,255,255,0.06)" }} />
              <Legend
                iconType="circle"
                wrapperStyle={{
                  color: "#cbcbcb",
                  fontSize: 12,
                  paddingTop: 10,
                }}
              />
              <Bar dataKey="totalLeads" fill="#58a6ff" name="Total leads" radius={[8, 8, 0, 0]} />
              <Bar dataKey="strongLeads" fill="#1ed760" name="Strong leads" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
  label,
  tone = "neutral",
  value,
}: {
  label: string;
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
      <div className={`mt-2 text-[22px] font-bold leading-none tracking-[-0.04em] ${toneClass}`}>{value}</div>
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
