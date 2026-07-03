"use client";

import { useState, type ReactNode } from "react";

import type { CampaignLeadView } from "@/lib/campaign-leads";

export function PublicCampaignLeadCards({ leads }: { leads: CampaignLeadView[] }) {
  const [expandedLeadIds, setExpandedLeadIds] = useState<string[]>([]);

  return (
    <>
      {leads.map((lead) => (
        <PublicLeadCard
          expanded={expandedLeadIds.includes(lead.id)}
          key={lead.id}
          lead={lead}
          onToggleExpanded={() =>
            setExpandedLeadIds((current) =>
              current.includes(lead.id)
                ? current.filter((id) => id !== lead.id)
                : [...current, lead.id],
            )
          }
        />
      ))}
    </>
  );
}

function PublicLeadCard({
  expanded,
  lead,
  onToggleExpanded,
}: {
  expanded: boolean;
  lead: CampaignLeadView;
  onToggleExpanded: () => void;
}) {
  const sourceText = getContentPreview(lead.redditItem.body, lead.redditItem.description, expanded);
  const hasExpandableSourceText = hasLongContent(lead.redditItem.body, lead.redditItem.description);

  return (
    <article className="rounded-[18px] bg-[linear-gradient(180deg,#1f1f1f_0%,#1a1a1a_100%)] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] sm:rounded-[22px] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{lead.redditItem.type}</Badge>
            <Badge tone={lead.label === "HIGH" ? "good" : lead.label === "MED" ? "neutral" : "muted"}>{lead.label}</Badge>
            {lead.ai?.category ? <Badge tone="neutral">{lead.ai.category}</Badge> : null}
          </div>
          <div>
            <h3 className="text-[16px] font-semibold leading-6 text-[#fdfdfd] [overflow-wrap:anywhere] sm:text-[17px]">
              {lead.redditItem.title || sourceText || "Untitled Reddit item"}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3] sm:gap-3 sm:tracking-[0.18em]">
              <span>r/{lead.redditItem.subreddit}</span>
              <span>Scored {formatDate(lead.createdAt)}</span>
              {lead.ai?.intentType ? <span>{formatEnumLabel(lead.ai.intentType)}</span> : null}
              {lead.ai?.buyerStage ? <span>{formatEnumLabel(lead.ai.buyerStage)}</span> : null}
            </div>
          </div>

          <div className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            <p className="text-[14px] leading-6 text-[#cbcbcb]">
              {lead.ai?.summary?.trim() || "No summary available for this lead."}
            </p>
          </div>

          {sourceText ? (
            <div className="border-t border-white/8 pt-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Source text</div>
              <p className="mt-2 text-[14px] leading-6 text-[#bdbdbd]">{sourceText}</p>
              {hasExpandableSourceText ? (
                <button
                  className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#fdfdfd] transition-colors hover:text-[#cbcbcb]"
                  onClick={onToggleExpanded}
                  type="button"
                >
                  {expanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </div>
          ) : null}

          {lead.redditItem.url ? (
            <div className="flex pt-1 sm:justify-end">
              <a
                className="inline-flex w-full items-center justify-center rounded-full bg-[#1ed760] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#121212] transition-colors hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] sm:w-auto"
                href={lead.redditItem.url}
                rel="noreferrer"
                target="_blank"
              >
                View on Reddit
              </a>
            </div>
          ) : null}
        </div>
        <div className="w-full rounded-[18px] bg-[#121212] px-4 py-3 text-left shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:w-auto sm:min-w-[112px] sm:text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Score</div>
          <div className="mt-2 text-[30px] font-bold leading-none tracking-[-0.05em] text-[#ffffff]">{lead.score}</div>
        </div>
      </div>
    </article>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "good" | "neutral" | "muted";
}) {
  const className =
    tone === "good"
      ? "bg-[#121212] text-[#1ed760]"
      : tone === "muted"
        ? "bg-[#121212] text-[#b3b3b3]"
        : "bg-[#121212] text-[#fdfdfd]";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${className}`}>
      {children}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getContentPreview(body: string | null, description: string | null, expanded = false) {
  const content = (body?.trim() || description?.trim() || "").replace(/\s+/g, " ").trim();

  if (!content) {
    return "";
  }

  if (expanded || content.length <= 280) {
    return content;
  }

  return `${content.slice(0, 277)}...`;
}

function hasLongContent(body: string | null, description: string | null) {
  const content = (body?.trim() || description?.trim() || "").replace(/\s+/g, " ").trim();
  return content.length > 280;
}

function formatEnumLabel(value: string) {
  return value.replace(/_/g, " ");
}
