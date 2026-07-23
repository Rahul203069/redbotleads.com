"use client";

import { useMemo, useState } from "react";
import { Check, Clock3, Copy } from "lucide-react";

import { DeleteCampaignLeadDialog } from "@/components/campaigns/delete-campaign-lead-dialog";
import { sendCampaignClientActivity } from "@/components/campaigns/client-activity-tracker";

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
const nonAdminScoreSortOptions = ["SCORE_DESC", "SCORE_ASC"] as const;
const MIN_VISIBLE_LEAD_SCORE = 40;
const MIN_COPY_LEAD_SCORE = 40;

export function ClassifiedLeadsPanel({
  campaignId,
  canDeleteLeads = false,
  isFilterLoading = false,
  leads,
  nextSyncLabel = "the next scheduled run",
  showJsonExport = true,
  showSemanticSort = true,
  showStatusFilter = true,
  shouldWaitForNextSync = false,
  syncStatus = "IDLE",
  trackClientActivity = false,
  onLeadDeleted,
}: {
  campaignId: string;
  canDeleteLeads?: boolean;
  isFilterLoading?: boolean;
  leads: ClassifiedLead[];
  nextSyncLabel?: string;
  showJsonExport?: boolean;
  showSemanticSort?: boolean;
  showStatusFilter?: boolean;
  shouldWaitForNextSync?: boolean;
  syncStatus?: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  trackClientActivity?: boolean;
  onLeadDeleted?: (leadId: string) => void;
}) {
  const [labelFilter, setLabelFilter] = useState<(typeof labelFilters)[number]>("ALL");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("ALL");
  const [scoreSort, setScoreSort] = useState<(typeof scoreSortOptions)[number]>("SCORE_DESC");
  const [expandedLeadIds, setExpandedLeadIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const activeScoreSort = showSemanticSort || scoreSort !== "SEMANTIC_DESC" ? scoreSort : "SCORE_DESC";
  const availableScoreSortOptions = showSemanticSort ? scoreSortOptions : nonAdminScoreSortOptions;

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

        if (showStatusFilter && statusFilter !== "ALL" && lead.status !== statusFilter) {
          return false;
        }

        return true;
      });

      nextLeads.sort((left, right) =>
        activeScoreSort === "SCORE_DESC"
          ? right.score - left.score
          : activeScoreSort === "SCORE_ASC"
            ? left.score - right.score
            : (right.semanticScore ?? -1) - (left.semanticScore ?? -1),
      );

      return nextLeads;
    },
    [activeScoreSort, classifiedLeads, labelFilter, showStatusFilter, statusFilter],
  );
  const copyableLeads = useMemo(
    () => filteredLeads.filter((lead) => lead.score >= MIN_COPY_LEAD_SCORE),
    [filteredLeads],
  );
  const isProcessing = syncStatus === "QUEUED" || syncStatus === "PROCESSING";
  const shouldShowWaitingState = isProcessing || shouldWaitForNextSync;
  const isCompleted = syncStatus === "COMPLETED";

  async function handleCopyVisibleLeads() {
    await copyTextToClipboard(
      JSON.stringify(
        {
          copiedAt: new Date().toISOString(),
          filters: {
            label: labelFilter,
            minScore: MIN_COPY_LEAD_SCORE,
            sort: activeScoreSort,
            status: showStatusFilter ? statusFilter : null,
          },
          leads: copyableLeads.map(formatLeadForJson),
          totalLeads: copyableLeads.length,
        },
        null,
        2,
      ),
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section aria-busy={isFilterLoading} className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
      <div className="border-b border-white/8 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-[24px] font-bold tracking-tight text-[#ffffff]">Classified leads</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">
              Only leads that passed semantic matching and finished LLM classification appear here.
            </p>
          </div>
          <div className={`grid w-full gap-3 sm:w-auto ${showStatusFilter ? "sm:grid-cols-4" : "sm:grid-cols-3"} lg:flex lg:flex-row`}>
            {!shouldShowWaitingState && !isFilterLoading ? (
              <>
                {showJsonExport ? (
                  <div className="grid gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Export</span>
                    <button
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full border-none bg-[#121212] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#fdfdfd] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] outline-none transition-colors hover:bg-[#252525] focus-visible:ring-2 focus-visible:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[160px]"
                      disabled={copyableLeads.length === 0}
                      onClick={handleCopyVisibleLeads}
                      type="button"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy JSON"}
                    </button>
                  </div>
                ) : null}
                <FilterGroup
                  label="Label"
                  options={labelFilters}
                  value={labelFilter}
                  onChange={setLabelFilter}
                />
                {showStatusFilter ? (
                  <FilterGroup
                    label="Status"
                    options={statusFilters}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />
                ) : null}
                <FilterGroup
                  label="Sort"
                  options={availableScoreSortOptions}
                  value={activeScoreSort}
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
        {isFilterLoading ? (
          <ClassifiedLeadsLoadingSkeleton />
        ) : shouldShowWaitingState ? (
          <WaitingForNextSyncState nextSyncLabel={nextSyncLabel} />
        ) : isCompleted && classifiedLeads.length === 0 ? (
          <NoLeadsFoundState />
        ) : classifiedLeads.length === 0 ? (
          <NoLeadsYetState nextSyncLabel={nextSyncLabel} syncStatus={syncStatus} />
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
                    <div className="w-full rounded-[18px] bg-[#121212] px-4 py-3 text-left shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:w-auto sm:text-right">
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
                          onClick={() => {
                            const isExpanding = !expandedLeadIds.includes(lead.id);

                            setExpandedLeadIds((current) =>
                              current.includes(lead.id)
                                ? current.filter((id) => id !== lead.id)
                                : [...current, lead.id],
                            );

                            if (isExpanding && trackClientActivity) {
                              sendCampaignClientActivity({
                                campaignId,
                                eventType: "LEAD_EXPANDED",
                                leadId: lead.id,
                              });
                            }
                          }}
                          type="button"
                        >
                          {expandedLeadIds.includes(lead.id) ? "Show less" : "Show more"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3 pt-1 sm:justify-end">
                    {canDeleteLeads && onLeadDeleted ? (
                      <DeleteCampaignLeadDialog
                        campaignId={campaignId}
                        lead={{
                          id: lead.id,
                          score: lead.score,
                          subreddit: lead.redditItem.subreddit,
                          title: lead.redditItem.title,
                        }}
                        onDeleted={onLeadDeleted}
                      />
                    ) : null}
                    {lead.redditItem.url ? (
                      <a
                        className="inline-flex w-full items-center justify-center rounded-full bg-[#1ed760] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#121212] transition-colors hover:bg-[#3be477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] sm:w-auto"
                        href={lead.redditItem.url}
                        onClick={() => {
                          if (trackClientActivity) {
                            sendCampaignClientActivity({
                              campaignId,
                              eventType: "REDDIT_LINK_CLICKED",
                              leadId: lead.id,
                            });
                          }
                        }}
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

function ClassifiedLeadsLoadingSkeleton() {
  return (
    <div aria-live="polite" className="space-y-4">
      <p className="sr-only">Loading filtered leads.</p>
      {Array.from({ length: 3 }).map((_, index) => (
        <article
          key={index}
          className="rounded-[22px] bg-[linear-gradient(180deg,#1f1f1f_0%,#1a1a1a_100%)] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SkeletonBlock className="h-6 w-16 rounded-full" />
                    <SkeletonBlock className="h-6 w-14 rounded-full" />
                    <SkeletonBlock className="h-6 w-20 rounded-full" />
                  </div>
                  <SkeletonBlock className="mt-4 h-5 w-full max-w-2xl" />
                  <SkeletonBlock className="mt-3 h-4 w-3/4 max-w-xl" />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <SkeletonBlock className="h-3 w-20 rounded-full" />
                    <SkeletonBlock className="h-3 w-24 rounded-full" />
                    <SkeletonBlock className="h-3 w-16 rounded-full" />
                  </div>
                </div>
                <div className="w-full rounded-[18px] bg-[#121212] px-4 py-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:w-[90px]">
                  <SkeletonBlock className="h-3 w-12 rounded-full" />
                  <SkeletonBlock className="mt-3 h-8 w-14" />
                </div>
              </div>
              <div className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="mt-3 h-4 w-5/6" />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[12px] bg-[#2a2a2a] ${className}`} />;
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
  nextSyncLabel,
  syncStatus,
}: {
  nextSyncLabel: string;
  syncStatus: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
}) {
  if (syncStatus !== "FAILED") {
    return <WaitingForNextSyncState nextSyncLabel={nextSyncLabel} />;
  }

  return (
    <div className="rounded-[20px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">Lead inbox</p>
      <h3 className="mt-2 text-[22px] font-bold tracking-[-0.04em] text-[#ffffff]">No classified leads yet.</h3>
      <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#cbcbcb]">
        The latest sync did not complete successfully, so there are no final classified leads to show yet.
      </p>
    </div>
  );
}

function WaitingForNextSyncState({ nextSyncLabel }: { nextSyncLabel: string }) {
  return (
    <div className="rounded-[20px] bg-[#1f1f1f] px-5 py-8 text-center shadow-[rgba(0,0,0,0.3)_0px_8px_8px] sm:px-6">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#121212] text-[#1ed760] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1ed760]/10">
          <Clock3 className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">Waiting for next sync</p>
      <h3 className="mx-auto mt-2 max-w-xl text-[20px] font-bold tracking-[-0.03em] text-[#ffffff]">
        Leads will start appearing after the next sync.
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-[14px] leading-6 text-[#cbcbcb]">
        Leads will appear here after Reddit posts are collected, matched, and scored during the scheduled run.
      </p>
      <div className="mx-auto mt-5 w-full max-w-[300px] rounded-[16px] bg-[#121212] px-4 py-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Next sync</p>
        <p className="mt-2 text-[16px] font-bold leading-6 text-[#ffffff]">{nextSyncLabel}</p>
      </div>
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
        className="flex h-11 w-full rounded-full border-none bg-[#121212] px-4 text-sm text-[#fdfdfd] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/10 sm:min-w-[160px]"
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

function formatLeadForJson(lead: ClassifiedLead) {
  return {
    id: lead.id,
    score: lead.score,
    semanticScore: lead.semanticScore,
    label: lead.label,
    status: lead.status,
    createdAt: lead.createdAt,
    ai: lead.ai
      ? {
          intentType: lead.ai.intentType,
          buyerStage: lead.ai.buyerStage,
          category: lead.ai.category,
          summary: lead.ai.summary,
          painPoints: lead.ai.painPoints,
          disqualifier: lead.ai.disqualifier,
        }
      : null,
    redditItem: {
      type: lead.redditItem.type,
      subreddit: lead.redditItem.subreddit,
      title: lead.redditItem.title,
      description: lead.redditItem.description,
      body: lead.redditItem.body,
      url: lead.redditItem.url,
    },
  };
}

async function copyTextToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back to the legacy copy path below.
    }
  }

  if (typeof document === "undefined" || !document.body) {
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);
  textArea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textArea);
  }
}
