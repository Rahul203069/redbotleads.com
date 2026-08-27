import type { CampaignHistoricalLeadSummary } from "@/lib/campaign-lead-inbox";

export function CampaignHistoricalSummary({
  summary,
}: {
  summary: CampaignHistoricalLeadSummary;
}) {
  return (
    <section aria-label="Historical lead summary">
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
