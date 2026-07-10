"use client";

import Link from "next/link";
import { ArrowDownWideNarrow, Check, Copy, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

type PlaygroundResultSort = "semantic" | "llm";
const MIN_COPY_LEAD_SCORE = 50;

type SemanticPlaygroundProgress = {
  candidatePosts: number;
  classificationFailed: number;
  classified: number;
  semanticMatches: number;
};

export type SemanticPlaygroundResultItem = {
  bestQueryText: string | null;
  bestScore: number;
  buyerStage: string | null;
  category: string | null;
  classificationStatus: string;
  disqualifier: string | null;
  error: string | null;
  id: string;
  intentType: string | null;
  label: string | null;
  model: string | null;
  painPoints: string[];
  redditItem: {
    author: string | null;
    body: string | null;
    createdUtc: string;
    description: string | null;
    fetchedAt: string;
    subreddit: string;
    title: string | null;
    url: string | null;
  };
  score: number | null;
  summary: string | null;
};

export function SemanticPlaygroundResults({
  isRunActive,
  progress,
  results,
  runStatus,
  totalMatches,
}: {
  isRunActive: boolean;
  progress: SemanticPlaygroundProgress;
  results: SemanticPlaygroundResultItem[];
  runStatus: string;
  totalMatches: number;
}) {
  const [sortBy, setSortBy] = useState<PlaygroundResultSort>("semantic");
  const [copied, setCopied] = useState(false);
  const sortedResults = useMemo(() => sortResults(results, sortBy), [results, sortBy]);
  const copyableResults = useMemo(
    () => sortedResults.filter((result) => (result.score ?? -1) >= MIN_COPY_LEAD_SCORE),
    [sortedResults],
  );
  const runStatusLabel = runStatus === "QUEUED" ? "Queued" : "Processing";

  async function handleCopyQualifiedLeads() {
    await copyTextToClipboard(
      JSON.stringify(
        {
          copiedAt: new Date().toISOString(),
          minScore: MIN_COPY_LEAD_SCORE,
          leads: copyableResults.map(formatPlaygroundLeadForJson),
          totalLeads: copyableResults.length,
        },
        null,
        2,
      ),
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex max-h-[72dvh] min-h-0 flex-col overflow-hidden rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] xl:max-h-[calc(100dvh-12rem)]">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[#27272a] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Results</p>
          <h3 className="mt-2 text-[17px] font-bold text-[#ffffff]">Matched Reddit posts</h3>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {isRunActive ? (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#1f1f1f] px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffd66e] shadow-[rgb(242,201,76)_0px_0px_0px_1px_inset]">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
              {runStatusLabel}
            </span>
          ) : (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">
                Showing {results.length} of {totalMatches}
              </span>

              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffffff] shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={copyableResults.length === 0}
                onClick={handleCopyQualifiedLeads}
                type="button"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy 50+ JSON"}
              </button>

              <div className="inline-flex min-h-10 items-center rounded-full bg-[#1f1f1f] p-1 shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset]">
                <ArrowDownWideNarrow className="ml-2 h-4 w-4 text-[#b3b3b3]" />
                <SortButton active={sortBy === "semantic"} onClick={() => setSortBy("semantic")}>
                  Semantic
                </SortButton>
                <SortButton active={sortBy === "llm"} onClick={() => setSortBy("llm")}>
                  LLM score
                </SortButton>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain pr-1">
        {isRunActive ? (
          <ProcessingState progress={progress} runStatusLabel={runStatusLabel} />
        ) : sortedResults.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[#3f3f46] p-5 text-[13px] leading-5 text-[#b3b3b3]">
            No Reddit posts matched this query set and threshold.
          </div>
        ) : (
          sortedResults.map((result) => <ResultCard key={result.id} result={result} />)
        )}
      </div>
    </div>
  );
}

function ProcessingState({
  progress,
  runStatusLabel,
}: {
  progress: SemanticPlaygroundProgress;
  runStatusLabel: string;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-3">
      <div className="rounded-[16px] bg-[#1f1f1f] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3b2d10] text-[#ffd66e] shadow-[rgb(242,201,76)_0px_0px_0px_1px_inset]">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#ffd66e]">{runStatusLabel}</p>
            <p className="mt-2 text-[13px] leading-5 text-[#cbcbcb]">
              Leads will appear here after semantic matching and LLM classification finish.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <ProgressMetric label="Candidates" value={progress.candidatePosts} />
          <ProgressMetric label="Semantic matches" value={progress.semanticMatches} />
          <ProgressMetric label="Classified" value={progress.classified} />
          <ProgressMetric label="Failed" value={progress.classificationFailed} />
        </div>
      </div>

      {[0, 1, 2].map((item) => (
        <div className="rounded-[16px] bg-[#1f1f1f] p-4 motion-safe:animate-pulse" key={item}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex gap-2">
                <div className="h-6 w-24 rounded-full bg-[#2a2a2a]" />
                <div className="h-6 w-20 rounded-full bg-[#2a2a2a]" />
              </div>
              <div className="mt-4 h-5 w-3/4 rounded bg-[#2a2a2a]" />
              <div className="mt-3 h-4 w-1/2 rounded bg-[#2a2a2a]" />
              <div className="mt-5 h-16 rounded-[14px] bg-[#171717]" />
            </div>
            <div className="h-20 w-full rounded-[16px] bg-[#171717] sm:w-[104px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] bg-[#121212] px-3 py-3 shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">{label}</p>
      <p className="mt-2 text-[22px] font-bold leading-none text-[#ffffff]">{value}</p>
    </div>
  );
}

function SortButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`min-h-8 rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
        active
          ? "bg-[#1ed760] text-[#121212]"
          : "text-[#cbcbcb] hover:bg-[#2a2a2a] hover:text-[#ffffff]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ResultCard({ result }: { result: SemanticPlaygroundResultItem }) {
  const sourceText = getSourcePreview(result.redditItem.body, result.redditItem.description);

  return (
    <article className="rounded-[16px] bg-[#1f1f1f] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={`semantic ${result.bestScore.toFixed(3)}`} tone="good" />
            <StatusPill label={result.classificationStatus.toLowerCase()} tone={statusTone(result.classificationStatus)} />
            {result.label ? <StatusPill label={result.label.toLowerCase()} tone={result.label === "HIGH" ? "good" : "neutral"} /> : null}
            {result.category ? <StatusPill label={result.category} tone="neutral" /> : null}
          </div>

          <h4 className="mt-3 text-[15px] font-bold leading-6 text-[#ffffff] [overflow-wrap:anywhere]">
            {result.redditItem.title || sourceText || "Untitled Reddit post"}
          </h4>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">
            <span>r/{result.redditItem.subreddit}</span>
            <span>Fetched {formatDate(result.redditItem.fetchedAt)}</span>
            <span>Posted {formatDate(result.redditItem.createdUtc)}</span>
            {result.intentType ? <span>{formatEnum(result.intentType)}</span> : null}
            {result.buyerStage ? <span>{formatEnum(result.buyerStage)}</span> : null}
          </div>

          {result.bestQueryText ? (
            <div className="mt-4 rounded-[14px] bg-[#121212] p-3 text-[13px] leading-5 text-[#cbcbcb]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">Matched query</span>
              <p className="mt-2">{result.bestQueryText}</p>
            </div>
          ) : null}

          {result.summary ? (
            <p className="mt-4 text-[14px] leading-6 text-[#cbcbcb]">{result.summary}</p>
          ) : null}

          {result.disqualifier ? (
            <p className="mt-3 text-[13px] leading-5 text-[#f2c94c]">{result.disqualifier}</p>
          ) : null}

          {result.error ? (
            <p className="mt-3 rounded-[14px] bg-[#3a151b] px-3 py-2 text-[13px] leading-5 text-[#ff9aa5]">
              {result.error}
            </p>
          ) : null}

          {result.painPoints.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {result.painPoints.map((point) => (
                <span className="rounded-full bg-[#121212] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#cbcbcb]" key={point}>
                  {point}
                </span>
              ))}
            </div>
          ) : null}

          {sourceText ? <p className="mt-4 text-[13px] leading-5 text-[#b3b3b3]">{sourceText}</p> : null}

          {result.redditItem.url ? (
            <Link
              className="mt-4 inline-flex min-h-9 items-center rounded-full bg-[#1ed760] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#121212] transition-colors hover:bg-[#3be477]"
              href={result.redditItem.url}
              rel="noreferrer"
              target="_blank"
            >
              View on Reddit
            </Link>
          ) : null}
        </div>

        <div className="w-full rounded-[16px] bg-[#121212] px-4 py-3 text-left shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:w-auto sm:min-w-[104px] sm:text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">LLM score</div>
          <div className="mt-2 text-[30px] font-bold leading-none text-[#ffffff]">
            {result.score ?? "-"}
          </div>
          {result.model ? <div className="mt-2 text-[10px] text-[#b3b3b3]">{result.model}</div> : null}
        </div>
      </div>
    </article>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "good" | "neutral" | "warn" | "bad" }) {
  const className =
    tone === "good"
      ? "bg-[#12331f] text-[#73f5a0] shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset]"
      : tone === "warn"
        ? "bg-[#3b2d10] text-[#ffd66e] shadow-[rgb(242,201,76)_0px_0px_0px_1px_inset]"
        : tone === "bad"
          ? "bg-[#3a151b] text-[#ff9aa5] shadow-[rgb(243,114,127)_0px_0px_0px_1px_inset]"
          : "bg-[#1f1f1f] text-[#cbcbcb] shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset]";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${className}`}>
      {label}
    </span>
  );
}

function sortResults(results: SemanticPlaygroundResultItem[], sortBy: PlaygroundResultSort) {
  return [...results].sort((left, right) => {
    if (sortBy === "llm") {
      const leftScore = left.score ?? -1;
      const rightScore = right.score ?? -1;
      return rightScore - leftScore || right.bestScore - left.bestScore;
    }

    return right.bestScore - left.bestScore || (right.score ?? -1) - (left.score ?? -1);
  });
}

function statusTone(status: string): "good" | "neutral" | "warn" | "bad" {
  if (status === "COMPLETED" || status === "CLASSIFIED" || status === "HIGH") {
    return "good";
  }

  if (status === "FAILED") {
    return "bad";
  }

  if (status === "PROCESSING" || status === "QUEUED" || status === "PENDING") {
    return "warn";
  }

  return "neutral";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatEnum(value: string) {
  return value.toLowerCase().replace(/_/g, " ");
}

function getSourcePreview(body: string | null, description: string | null) {
  const content = (body?.trim() || description?.trim() || "").replace(/\s+/g, " ").trim();

  if (content.length <= 360) {
    return content;
  }

  return `${content.slice(0, 357)}...`;
}

function formatPlaygroundLeadForJson(result: SemanticPlaygroundResultItem) {
  return {
    id: result.id,
    score: result.score,
    semanticScore: result.bestScore,
    classificationStatus: result.classificationStatus,
    label: result.label,
    intentType: result.intentType,
    buyerStage: result.buyerStage,
    category: result.category,
    summary: result.summary,
    painPoints: result.painPoints,
    disqualifier: result.disqualifier,
    model: result.model,
    error: result.error,
    matchedQuery: result.bestQueryText,
    redditItem: {
      author: result.redditItem.author,
      body: result.redditItem.body,
      createdUtc: result.redditItem.createdUtc,
      description: result.redditItem.description,
      fetchedAt: result.redditItem.fetchedAt,
      subreddit: result.redditItem.subreddit,
      title: result.redditItem.title,
      url: result.redditItem.url,
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
