import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { CAMPAIGN_LEAD_STATUS_LABELS, type CampaignLeadStatus } from "@/lib/campaign-lead-status";
import type { LiveLeadView } from "@/lib/live-leads";
import { formatDateTimeInTimeZone } from "@/lib/time-zone";

export function ReadOnlyLiveLeadFeed({
  appearance = "default",
  emptyDescription,
  emptyTitle,
  leads,
  timeZone,
}: {
  appearance?: "daily" | "default";
  emptyDescription: string;
  emptyTitle: string;
  leads: LiveLeadView[];
  timeZone: string;
}) {
  if (leads.length === 0) {
    if (appearance === "daily") {
      return (
        <div className="rounded-[22px] bg-[#1f1f1f] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">No qualified leads</p>
          <h3 className="mt-2 text-[22px] font-bold tracking-[-0.04em] text-white">{emptyTitle}</h3>
          <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#cbcbcb]">{emptyDescription}</p>
        </div>
      );
    }

    return (
      <div className="rounded-[22px] border border-dashed border-white/[0.12] bg-[#111111] px-5 py-12 text-center">
        <p className="text-[16px] font-bold text-white">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-[#9f9f9f]">
          {emptyDescription}
        </p>
      </div>
    );
  }

  if (appearance === "daily") {
    return (
      <div className="space-y-4">
        {leads.map((lead) => (
          <DailyReadOnlyLeadCard key={lead.id} lead={lead} timeZone={timeZone} />
        ))}
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

function DailyReadOnlyLeadCard({ lead, timeZone }: { lead: LiveLeadView; timeZone: string }) {
  const redditContent = lead.redditItem.body?.trim() || lead.redditItem.description?.trim();
  const intentDetails = [
    lead.ai?.intentType ? { label: "Intent type", value: formatEnumLabel(lead.ai.intentType) } : null,
    lead.ai?.buyerStage ? { label: "Buyer stage", value: formatEnumLabel(lead.ai.buyerStage) } : null,
    lead.ai?.category ? { label: "Category", value: formatEnumLabel(lead.ai.category) } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <article
      className="rounded-[22px] bg-[linear-gradient(180deg,#1f1f1f_0%,#1a1a1a_100%)] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] transition-colors hover:bg-[linear-gradient(180deg,#252525_0%,#1f1f1f_100%)]"
      id={`lead-${lead.id}`}
    >
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <DailyBadge tone="neutral">{lead.redditItem.type}</DailyBadge>
              <DailyBadge tone={lead.label === "HIGH" ? "good" : lead.label === "MED" ? "neutral" : "muted"}>
                {lead.label}
              </DailyBadge>
              <DailyBadge tone="muted">{CAMPAIGN_LEAD_STATUS_LABELS[lead.status]}</DailyBadge>
              {lead.ai?.category ? <DailyBadge tone="neutral">{formatEnumLabel(lead.ai.category)}</DailyBadge> : null}
            </div>
            <h3 className="mt-3 text-[16px] font-semibold leading-6 text-[#fdfdfd] [overflow-wrap:anywhere]">
              {lead.redditItem.title || (lead.redditItem.type === "COMMENT" ? "Reddit comment" : "Untitled Reddit post")}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
              <span>r/{lead.redditItem.subreddit}</span>
              <time className="text-[#7cf5a3]" dateTime={lead.redditItem.createdUtc}>
                Posted {formatDateTimeInTimeZone(lead.redditItem.createdUtc, timeZone)}
              </time>
              <time dateTime={lead.createdAt}>Found {formatDateTimeInTimeZone(lead.createdAt, timeZone)}</time>
              {lead.ai?.intentType ? <span>{formatEnumLabel(lead.ai.intentType)}</span> : null}
              {lead.ai?.buyerStage ? <span>{formatEnumLabel(lead.ai.buyerStage)}</span> : null}
            </div>
          </div>
          <div className="w-full rounded-[18px] bg-[#121212] px-4 py-3 text-left shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:w-auto sm:min-w-24 sm:text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Score</div>
            <div className="mt-2 text-[30px] font-bold leading-none tracking-[-0.05em] text-white">{lead.score}</div>
            {lead.semanticScore !== null ? (
              <div className="mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8f8f8f]">
                Semantic {Math.round(lead.semanticScore * 100)}%
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Why it matched</p>
          <p className="mt-2 break-words text-[14px] leading-6 text-[#cbcbcb]">
            {lead.ai?.summary?.trim() || "No AI match explanation is available."}
          </p>
        </div>

        <div className="border-t border-white/8 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
            {lead.redditItem.type === "COMMENT" ? "Reddit comment" : "Reddit post"}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-6 text-[#bdbdbd]">
            {redditContent || "No Reddit content is available for this lead."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {intentDetails.length ? intentDetails.map((item) => (
            <DailyDetail key={item.label} label={item.label} value={item.value} />
          )) : (
            <DailyDetail label="Intent" value="Not classified" />
          )}
        </div>

        <DailyDetail
          label="Pain points"
          value={lead.ai?.painPoints.length ? lead.ai.painPoints.join(" · ") : "No pain points identified."}
        />

        {lead.redditItem.url ? (
          <div className="flex sm:justify-end">
            <a
              className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1ed760] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#121212] transition-colors hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              href={lead.redditItem.url}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              View on Reddit
            </a>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function DailyBadge({ children, tone }: { children: ReactNode; tone: "good" | "muted" | "neutral" }) {
  const color = tone === "good"
    ? "text-[#1ed760]"
    : tone === "muted"
      ? "text-[#b3b3b3]"
      : "text-[#fdfdfd]";

  return (
    <span className={`inline-flex items-center rounded-full bg-[#121212] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${color}`}>
      {children}
    </span>
  );
}

function DailyDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">{label}</p>
      <p className="mt-2 break-words text-[14px] leading-6 text-[#cbcbcb]">{value}</p>
    </div>
  );
}

function formatEnumLabel(value: string) {
  return value.replace(/_/g, " ");
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
