import { ExternalLink } from "lucide-react";

import { CAMPAIGN_LEAD_STATUS_LABELS, type CampaignLeadStatus } from "@/lib/campaign-lead-status";
import type { LiveLeadView } from "@/lib/live-leads";
import { formatDateTimeInTimeZone } from "@/lib/time-zone";

export function ReadOnlyLiveLeadFeed({
  emptyDescription,
  emptyTitle,
  leads,
  timeZone,
}: {
  emptyDescription: string;
  emptyTitle: string;
  leads: LiveLeadView[];
  timeZone: string;
}) {
  if (leads.length === 0) {
    return (
      <div className="rounded-[22px] border border-dashed border-white/[0.12] bg-[#111111] px-5 py-12 text-center">
        <p className="text-[16px] font-bold text-white">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-[#9f9f9f]">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {leads.map((lead) => {
        const redditContent = lead.redditItem.body?.trim() || lead.redditItem.description?.trim();
        const intentDetails = [
          lead.ai?.intentType ? { label: "Intent type", value: lead.ai.intentType } : null,
          lead.ai?.buyerStage ? { label: "Buyer stage", value: lead.ai.buyerStage } : null,
          lead.ai?.category ? { label: "Category", value: lead.ai.category } : null,
        ].filter((item): item is { label: string; value: string } => item !== null);

        return (
          <article
            className={`overflow-hidden rounded-[20px] border bg-[#111111] ${lead.status === "NEW" ? "border-[#1ed760]/40" : "border-white/[0.08]"}`}
            id={`lead-${lead.id}`}
            key={lead.id}
          >
            <div className="p-4 sm:p-5 lg:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={lead.status} />
                <MetaPill label={lead.campaign.name} strong />
                <MetaPill label={`r/${lead.redditItem.subreddit}`} />
                <MetaPill label={lead.redditItem.type === "COMMENT" ? "Comment" : "Post"} uppercase />
              </div>

              <h3 className="mt-4 text-[18px] font-bold leading-7 text-white [overflow-wrap:anywhere] sm:text-[20px]">
                {lead.redditItem.title || (lead.redditItem.type === "COMMENT" ? "Reddit comment" : "Untitled Reddit post")}
              </h3>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
                <time className="font-bold text-[#55e982]" dateTime={lead.redditItem.createdUtc}>
                  Posted {formatDateTimeInTimeZone(lead.redditItem.createdUtc, timeZone)}
                </time>
                <time className="text-[#9f9f9f]" dateTime={lead.createdAt}>
                  Detected {formatDateTimeInTimeZone(lead.createdAt, timeZone)}
                </time>
                <span className="font-semibold text-[#d4d4d4]">{lead.score}% match</span>
                {lead.semanticScore !== null ? (
                  <span className="text-[#9f9f9f]">Semantic {Math.round(lead.semanticScore * 100)}%</span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 border-t border-white/[0.08] pt-5">
                <DetailBlock
                  label={lead.redditItem.type === "COMMENT" ? "Reddit comment" : "Reddit post"}
                  preserveWhitespace
                  value={redditContent || "No Reddit content is available for this lead."}
                />

                <DetailBlock
                  label="Why it matched"
                  value={lead.ai?.summary?.trim() || "No AI match explanation is available."}
                />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {intentDetails.length ? intentDetails.map((item) => (
                    <DetailBlock key={item.label} label={item.label} value={item.value} />
                  )) : (
                    <DetailBlock label="Intent" value="Not classified" />
                  )}
                </div>

                <DetailBlock
                  label="Pain points"
                  value={lead.ai?.painPoints.length
                    ? lead.ai.painPoints.join(" · ")
                    : "No pain points identified."}
                />

                {lead.redditItem.url ? (
                  <div>
                    <a
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-[#1ed760] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0d160f] transition-colors hover:bg-[#3be477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70"
                      href={lead.redditItem.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      View Reddit
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MetaPill({
  label,
  strong = false,
  uppercase = false,
}: {
  label: string;
  strong?: boolean;
  uppercase?: boolean;
}) {
  return (
    <span className={`rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[10px] ${strong ? "font-bold text-[#d4d4d4]" : "font-semibold text-[#a7a7a7]"} ${uppercase ? "uppercase tracking-[0.12em]" : ""}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: CampaignLeadStatus }) {
  const tone = status === "NEW"
    ? "bg-[#1ed760]/15 text-[#73f5a0]"
    : status === "SAVED"
      ? "bg-[#332c12] text-[#ffd66e]"
      : status === "CONTACTED"
        ? "bg-[#102742] text-[#8fc8ff]"
        : status === "DISMISSED"
          ? "bg-[#3a151b] text-[#ff9aa5]"
          : "bg-[#252525] text-[#c7c7c7]";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${tone}`}>
      {CAMPAIGN_LEAD_STATUS_LABELS[status]}
    </span>
  );
}

function DetailBlock({
  label,
  preserveWhitespace = false,
  value,
}: {
  label: string;
  preserveWhitespace?: boolean;
  value: string;
}) {
  return (
    <div className="rounded-[16px] bg-[#181818] p-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#737373]">{label}</p>
      <p className={`mt-2 break-words text-[13px] leading-6 text-[#d4d4d4] ${preserveWhitespace ? "whitespace-pre-wrap" : ""}`}>
        {value}
      </p>
    </div>
  );
}
