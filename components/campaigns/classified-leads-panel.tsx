"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

export function ClassifiedLeadsPanel({
  leads,
  isRefreshing = false,
}: {
  leads: ClassifiedLead[];
  isRefreshing?: boolean;
}) {
  const [labelFilter, setLabelFilter] = useState<(typeof labelFilters)[number]>("ALL");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("ALL");
  const [scoreSort, setScoreSort] = useState<(typeof scoreSortOptions)[number]>("SCORE_DESC");
  const [expandedLeadIds, setExpandedLeadIds] = useState<string[]>([]);

  const classifiedLeads = useMemo(() => leads.filter((lead) => lead.ai !== null), [leads]);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Classified leads</CardTitle>
            <CardDescription>All leads scored for this campaign, with quick filters for label and workflow status.</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {isRefreshing ? (
              <div className="self-end text-xs uppercase tracking-[0.22em] text-[#71717a] sm:self-auto">
                Refreshing
              </div>
            ) : null}
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {classifiedLeads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#27272a] bg-[#111113] px-4 py-8 text-sm leading-6 text-[#a1a1aa]">
            No classified leads yet. Once the worker finishes scoring, they will appear here.
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#27272a] bg-[#111113] px-4 py-8 text-sm leading-6 text-[#a1a1aa]">
            No classified leads match the active filters.
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <article key={lead.id} className="rounded-2xl border border-[#27272a] bg-[#111113] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{lead.redditItem.type}</Badge>
                    <Badge tone={lead.label === "HIGH" ? "good" : lead.label === "MED" ? "neutral" : "muted"}>{lead.label}</Badge>
                    <Badge tone="muted">{lead.status}</Badge>
                    {lead.ai?.category ? <Badge tone="neutral">{lead.ai.category}</Badge> : null}
                    {lead.ai?.intentType ? <Badge tone="neutral">{formatEnumLabel(lead.ai.intentType)}</Badge> : null}
                    {lead.ai?.buyerStage ? <Badge tone="neutral">{formatEnumLabel(lead.ai.buyerStage)}</Badge> : null}
                  </div>
                  <p className="mt-3 text-sm font-medium leading-6 text-[#fafafa]">
                    {lead.redditItem.title || lead.redditItem.body || "Untitled Reddit item"}
                  </p>
                  {getContentPreview(lead.redditItem.body, lead.redditItem.description) ? (
                    <div className="mt-3 rounded-2xl border border-[#27272a] bg-[#161618] px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#71717a]">Post content</div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#d4d4d8]">
                        {getContentPreview(
                          lead.redditItem.body,
                          lead.redditItem.description,
                          expandedLeadIds.includes(lead.id),
                        )}
                      </p>
                      {hasLongContent(lead.redditItem.body, lead.redditItem.description) ? (
                        <button
                          className="mt-3 text-xs uppercase tracking-[0.18em] text-[#fafafa] transition-colors hover:text-[#d4d4d8]"
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
                  <div className="mt-3 rounded-2xl border border-[#27272a] bg-[#18181b] px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#71717a]">Summary</div>
                    <p className="mt-2 text-sm leading-6 text-[#d4d4d8]">
                      {lead.ai?.summary?.trim() || "No summary available yet for this lead."}
                    </p>
                  </div>
                  {lead.ai?.disqualifier?.trim() ? (
                    <div className="mt-3 rounded-2xl border border-[#27272a] bg-[#18181b] px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#71717a]">Disqualifier</div>
                      <p className="mt-2 text-sm leading-6 text-[#d4d4d8]">{lead.ai.disqualifier}</p>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#71717a]">
                    <span>r/{lead.redditItem.subreddit}</span>
                    <span>Scored {formatDate(lead.createdAt)}</span>
                  </div>
                  {lead.redditItem.url ? (
                    <div className="mt-3">
                      <a
                        className="inline-flex items-center rounded-md border border-[#52525b] bg-[#18181b] px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[#fafafa] transition-colors hover:border-[#71717a] hover:bg-[#212124] hover:text-[#e4e4e7]"
                        href={lead.redditItem.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        View on Reddit
                      </a>
                    </div>
                  ) : null}
                  {lead.ai?.painPoints.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {lead.ai.painPoints.map((painPoint) => (
                        <span
                          key={painPoint}
                          className="rounded-full border border-[#27272a] bg-[#18181b] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[#a1a1aa]"
                        >
                          {painPoint}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs uppercase tracking-[0.2em] text-[#71717a]">Score</div>
                  <div className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#fafafa]">{lead.score}</div>
                  <div className="mt-3 text-xs uppercase tracking-[0.2em] text-[#71717a]">Semantic</div>
                  <div className="mt-1 text-sm font-medium text-[#d4d4d8]">
                    {lead.semanticScore !== null ? lead.semanticScore.toFixed(3) : "N/A"}
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
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
      <span className="text-xs uppercase tracking-[0.22em] text-[#71717a]">{label}</span>
      <select
        className="flex h-11 min-w-[140px] rounded-xl border border-[#27272a] bg-[#09090b] px-3 text-sm text-[#fafafa] outline-none transition-colors focus-visible:border-white/28 focus-visible:ring-2 focus-visible:ring-white/10"
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
      ? "border-[#52525b] bg-[#18181b] text-[#fafafa]"
      : tone === "muted"
        ? "border-[#27272a] bg-[#18181b] text-[#a1a1aa]"
        : "border-[#27272a] bg-[#18181b] text-[#fafafa]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${className}`}>
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
