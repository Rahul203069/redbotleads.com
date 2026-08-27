import { CalendarDays } from "lucide-react";

import type { CampaignHistoricalLeadSummary } from "@/lib/campaign-lead-inbox";

export function CampaignHistoricalSummary({
  periodLabel,
  summary,
}: {
  periodLabel: string;
  summary: CampaignHistoricalLeadSummary;
}) {
  return (
    <section aria-label="Historical lead summary">
      <div
        aria-atomic="true"
        aria-live="polite"
        className="mb-3 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-white/[0.06] bg-[#181818] px-3 py-2"
      >
        <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#55e982]" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#858585] sm:text-[10px]">
          Viewing
        </span>
        <span aria-hidden="true" className="text-[#666]">·</span>
        <h2 className="min-w-0 break-words text-[11px] font-bold leading-4 text-[#f3f5f4] sm:text-[12px]">
          {periodLabel}
        </h2>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <MetricCard label="Total leads" value={String(summary.leadCount)} />
        <MetricCard label="Strong matches" tone="positive" value={String(summary.strongMatchCount)} />
      </dl>
    </section>
  );
}

function MetricCard({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "positive";
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[20px] bg-[#181818] px-4 py-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] sm:px-5">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3] sm:text-[10px] sm:tracking-[0.2em]">
        {label}
      </dt>
      <dd className={`mt-3 truncate text-[1.65rem] font-bold leading-none tracking-[-0.05em] sm:text-[2rem] ${tone === "positive" ? "text-[#55e982]" : "text-[#ffffff]"}`}>
        {value}
      </dd>
    </div>
  );
}
