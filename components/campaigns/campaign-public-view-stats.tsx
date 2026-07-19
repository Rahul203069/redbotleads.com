import { Eye, FileText, ListFilter, Users } from "lucide-react";

import type { PublicShareMetric, PublicShareViewStats } from "@/lib/public-share-analytics-core";

const numberFormatter = new Intl.NumberFormat("en-US");

export function CampaignPublicViewStats({ stats }: { stats: PublicShareViewStats }) {
  return (
    <section
      aria-labelledby="public-link-activity-title"
      className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.35)_0px_8px_16px] sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1ed760]">Share analytics</p>
          <h2 id="public-link-activity-title" className="mt-2 text-[24px] font-bold tracking-[-0.03em] text-[#ffffff]">
            Public link activity
          </h2>
        </div>
        <p className="max-w-xl text-[13px] leading-5 text-[#b3b3b3] sm:text-right">
          Unique viewers are estimated per browser. Your own signed-in visits are excluded.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MetricCard icon={Eye} label="All public links" metric={stats.overall} />
        <MetricCard icon={FileText} label="Full campaign report" metric={stats.campaign} />
        <MetricCard icon={ListFilter} label="Leads-only report" metric={stats.leads} />
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  metric,
}: {
  icon: typeof Eye;
  label: string;
  metric: PublicShareMetric;
}) {
  const viewLabel = metric.views === 1 ? "open" : "opens";
  const visitorLabel = metric.uniqueVisitors === 1 ? "unique viewer" : "unique viewers";

  return (
    <article
      aria-label={`${label}: ${metric.views} ${viewLabel}, ${metric.uniqueVisitors} ${visitorLabel}`}
      className="rounded-[20px] bg-[#1f1f1f] p-5 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
    >
      <div className="flex items-center gap-2 text-[#cbcbcb]">
        <Icon aria-hidden="true" className="h-4 w-4 text-[#1ed760]" />
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em]">{label}</h3>
      </div>
      <p className="mt-4 tabular-nums text-[2rem] font-bold leading-none tracking-[-0.04em] text-[#ffffff]">
        {numberFormatter.format(metric.views)}
      </p>
      <p className="mt-2 text-[13px] text-[#cbcbcb]">{viewLabel}</p>
      <div className="mt-4 flex items-center gap-2 border-t border-white/8 pt-4 text-[12px] text-[#b3b3b3]">
        <Users aria-hidden="true" className="h-4 w-4" />
        <span className="tabular-nums">
          {numberFormatter.format(metric.uniqueVisitors)} {visitorLabel}
        </span>
      </div>
    </article>
  );
}
