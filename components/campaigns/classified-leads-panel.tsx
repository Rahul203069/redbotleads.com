"use client";

import { useMemo, useState } from "react";

export type ClassifiedLead = {
  id: string;
  score: number;
  semanticScore: number | null;
  label: "HIGH" | "MED" | "LOW";
  status: "NEW" | "SAVED" | "IGNORED" | "REPLIED";
  createdAt: string;
  ai: {
    intentType: "none" | "implicit" | "explicit" | "switching" | null;
    buyerStage: "solved" | "problem_aware" | "solution_aware" | "evaluating" | null;
    category: string | null;
    summary: string | null;
    painPoints: string[];
    disqualifier: string | null;
  } | null;
  redditItem: {
    type: "POST" | "COMMENT";
    subreddit: string;
    title: string | null;
    description: string | null;
    body: string | null;
    url: string | null;
  };
};

const labelFilters = ["ALL", "HIGH", "MED", "LOW"] as const;
const statusFilters = ["ALL", "NEW", "SAVED", "IGNORED", "REPLIED"] as const;
const scoreSortOptions = ["SCORE_DESC", "SCORE_ASC", "SEMANTIC_DESC"] as const;
const MIN_VISIBLE_LEAD_SCORE = 40;

export function ClassifiedLeadsPanel({
  leads,
  syncStatus = "IDLE",
}: {
  leads: ClassifiedLead[];
  syncStatus?: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
}) {
  const [labelFilter, setLabelFilter] = useState<(typeof labelFilters)[number]>("ALL");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("ALL");
  const [scoreSort, setScoreSort] = useState<(typeof scoreSortOptions)[number]>("SCORE_DESC");
  const [expandedLeadIds, setExpandedLeadIds] = useState<string[]>([]);

  const classifiedLeads = useMemo(
    () => leads.filter((lead) => lead.ai !== null && lead.score >= MIN_VISIBLE_LEAD_SCORE),
    [leads],
  );
  const filteredLeads = useMemo(
    () => {
      const nextLeads = classifiedLeads.filter((lead) => {
        if (labelFilter !== "ALL" && lead.label !== labelFilter) {
          return false;
        }

        if (statusFilter !== "ALL" && lead.status !== statusFilter) {
          return false;
        }

        return true;
      });

      nextLeads.sort((left, right) =>
        scoreSort === "SCORE_DESC"
          ? right.score - left.score
          : scoreSort === "SCORE_ASC"
            ? left.score - right.score
            : (right.semanticScore ?? -1) - (left.semanticScore ?? -1),
      );

      return nextLeads;
    },
    [classifiedLeads, labelFilter, scoreSort, statusFilter],
  );
  const isProcessing = syncStatus === "QUEUED" || syncStatus === "PROCESSING";
  const isCompleted = syncStatus === "COMPLETED";

  return (
    <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
      <div className="border-b border-white/8 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-[24px] font-bold tracking-tight text-[#ffffff]">Classified leads</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">
              Only leads that passed semantic matching and finished LLM classification appear here.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {!isProcessing ? (
              <>
                <FilterGroup
                  label="Label"
                  options={labelFilters}
                  value={labelFilter}
                  onChange={setLabelFilter}
                />
                <FilterGroup
                  label="Status"
                  options={statusFilters}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
                <FilterGroup
                  label="Sort"
                  options={scoreSortOptions}
                  value={scoreSort}
                  onChange={setScoreSort}
                  formatOptionLabel={(option) =>
                    option === "SCORE_DESC"
                      ? "Score high to low"
                      : option === "SCORE_ASC"
                        ? "Score low to high"
                        : "Semantic high to low"
                  }
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="space-y-4 pt-5">
        {isProcessing ? (
          <PendingLeadState />
        ) : isCompleted && classifiedLeads.length === 0 ? (
          <NoLeadsFoundState />
        ) : classifiedLeads.length === 0 ? (
          <NoLeadsYetState syncStatus={syncStatus} />
        ) : filteredLeads.length === 0 ? (
          <div className="rounded-[20px] bg-[#1f1f1f] px-4 py-8 text-[14px] leading-6 text-[#cbcbcb]">
            No classified leads match the active filters.
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <article
              key={lead.id}
              className="rounded-[22px] bg-[linear-gradient(180deg,#1f1f1f_0%,#1a1a1a_100%)] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] transition hover:bg-[linear-gradient(180deg,#252525_0%,#1f1f1f_100%)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{lead.redditItem.type}</Badge>
                        <Badge tone={lead.label === "HIGH" ? "good" : lead.label === "MED" ? "neutral" : "muted"}>{lead.label}</Badge>
                        <Badge tone="muted">{lead.status}</Badge>
                        {lead.ai?.category ? <Badge tone="neutral">{lead.ai.category}</Badge> : null}
                      </div>
                      <p className="mt-3 text-[16px] font-semibold leading-6 text-[#fdfdfd]">
                        {lead.redditItem.title || lead.redditItem.body || "Untitled Reddit item"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                        <span>r/{lead.redditItem.subreddit}</span>
                        <span>Scored {formatDate(lead.createdAt)}</span>
                        {lead.ai?.intentType ? <span>{formatEnumLabel(lead.ai.intentType)}</span> : null}
                        {lead.ai?.buyerStage ? <span>{formatEnumLabel(lead.ai.buyerStage)}</span> : null}
                      </div>
                    </div>
                    <div className="rounded-[18px] bg-[#121212] px-4 py-3 text-right shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Score</div>
                      <div className="mt-2 text-[30px] font-bold leading-none tracking-[-0.05em] text-[#ffffff]">{lead.score}</div>
                    </div>
                  </div>

                  <div className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                    <p className="text-[14px] leading-6 text-[#cbcbcb]">
                      {lead.ai?.summary?.trim() || "No summary available yet for this lead."}
                    </p>
                  </div>

                  {getContentPreview(lead.redditItem.body, lead.redditItem.description) ? (
                    <div className="border-t border-white/8 pt-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Source text</div>
                      <p className="mt-2 text-[14px] leading-6 text-[#bdbdbd]">
                        {getContentPreview(
                          lead.redditItem.body,
                          lead.redditItem.description,
                          expandedLeadIds.includes(lead.id),
                        )}
                      </p>
                      {hasLongContent(lead.redditItem.body, lead.redditItem.description) ? (
                        <button
                          className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#fdfdfd] transition-colors hover:text-[#cbcbcb]"
                          onClick={() =>
                            setExpandedLeadIds((current) =>
                              current.includes(lead.id)
                                ? current.filter((id) => id !== lead.id)
                                : [...current, lead.id],
                            )
                          }
                          type="button"
                        >
                          {expandedLeadIds.includes(lead.id) ? "Show less" : "Show more"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    {lead.redditItem.url ? (
                      <a
                        className="inline-flex items-center rounded-full bg-[#1ed760] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#121212] transition hover:scale-[1.02] hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
                        href={lead.redditItem.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        View on Reddit
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function PendingLeadState() {
  return (
    <div className="overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#1f1f1f_0%,#1a1a1a_100%)] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <div className="border-b border-white/8 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">Lead review in progress</p>
            <h3 className="mt-2 text-[22px] font-bold tracking-[-0.04em] text-[#ffffff]">Preparing the qualified lead set.</h3>
            <p className="mt-3 text-[14px] leading-6 text-[#cbcbcb]">
              The feed stays hidden until semantic filtering and LLM scoring finish, so this table only opens with the final reviewed leads.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-full bg-[#121212] px-4 py-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1ed760]/45" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#1ed760]" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1ed760]">Processing</span>
          </div>
        </div>
      </div>
      <div className="space-y-4 px-6 py-5">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
          <span className="text-[#ffffff]">What happens next</span>
          <span className="h-px flex-1 bg-white/8" />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <PendingStep label="Semantic pass" description="Checking Reddit items against the saved intent queries." />
          <PendingStep label="LLM scoring" description="Ranking qualified items for buying intent and fit." />
          <PendingStep label="Final feed" description="Publishing only the leads ready for review in this table." />
        </div>
      </div>
    </div>
  );
}

function PendingStep({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-[#1ed760]/40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1ed760]" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffffff]">{label}</p>
      </div>
      <p className="mt-3 text-[13px] leading-6 text-[#b3b3b3]">{description}</p>
    </div>
  );
}

function NoLeadsFoundState() {
  return (
    <div className="rounded-[22px] bg-[#1f1f1f] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">No qualified leads</p>
      <h3 className="mt-2 text-[22px] font-bold tracking-[-0.04em] text-[#ffffff]">No leads cleared the full pipeline.</h3>
      <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#cbcbcb]">
        The sync finished, but no Reddit items both passed semantic matching and received an LLM classification worth showing here.
      </p>
    </div>
  );
}

function NoLeadsYetState({
  syncStatus,
}: {
  syncStatus: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
}) {
  return (
    <div className="rounded-[22px] bg-[#1f1f1f] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">Lead inbox</p>
      <h3 className="mt-2 text-[22px] font-bold tracking-[-0.04em] text-[#ffffff]">No classified leads yet.</h3>
      <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#cbcbcb]">
        {syncStatus === "FAILED"
          ? "The latest sync did not complete successfully, so there are no final classified leads to show yet."
          : "Run a sync to populate this campaign with Reddit items that make it through semantic matching and LLM scoring."}
      </p>
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  formatOptionLabel,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatOptionLabel?: (value: T) => string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">{label}</span>
      <select
        className="flex h-11 min-w-[160px] rounded-full border-none bg-[#121212] px-4 text-sm text-[#fdfdfd] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/10"
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOptionLabel ? formatOptionLabel(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
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
