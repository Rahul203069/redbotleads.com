"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownWideNarrow, Check, Copy, ExternalLink, Loader2, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";

import { addPlaygroundResultToCampaignLead } from "@/app/(app)/admin/analytics/playground/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

type PlaygroundResultSort = "semantic" | "llm";
const MIN_COPY_LEAD_SCORE = 40;
const IST_OFFSET_MINUTES = 330;
const DAILY_SEMANTIC_CRON_UTC_HOUR = 15;
const DAILY_SEMANTIC_CRON_UTC_MINUTE = 0;

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
    <div className="flex max-h-[80dvh] min-h-[560px] flex-col overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#111111] p-4">
      <div className="flex shrink-0 flex-col gap-3 border-b border-white/[0.06] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#1ed760] text-[11px] font-black text-[#0d160f]">03</span>
          <div>
            <h3 className="text-[16px] font-bold text-[#ffffff]">Matched Reddit posts</h3>
            <p className="mt-1 text-[12px] leading-5 text-[#8f8f8f]">Review semantic fit, LLM score, and qualification details.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {isRunActive ? (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#f2c94c]/25 bg-[#f2c94c]/10 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffd66e]">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
              {runStatusLabel}
            </span>
          ) : (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">
                Showing {results.length} of {totalMatches}
              </span>

              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-[#1b1b1b] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffffff] transition-colors hover:bg-[#252525] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/60 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={copyableResults.length === 0}
                onClick={handleCopyQualifiedLeads}
                type="button"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy 40+ JSON"}
              </button>

              <div className="inline-flex min-h-10 items-center rounded-full border border-white/[0.08] bg-[#1b1b1b] p-1">
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
          <div className="rounded-[16px] border border-dashed border-[#3f3f46] bg-[#151515] p-5 text-[13px] leading-5 text-[#b3b3b3]">
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
      <div className="rounded-[16px] border border-white/[0.06] bg-[#181818] p-4">
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
        <div className="rounded-[16px] border border-white/[0.06] bg-[#181818] p-4 motion-safe:animate-pulse" key={item}>
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
    <div className="rounded-[14px] border border-white/[0.06] bg-[#111111] px-3 py-3">
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
  const router = useRouter();
  const { toast } = useToast();
  const sourceText = getSourcePreview(result.redditItem.body, result.redditItem.description);
  const inferredSyncAtIso = getInferredDailySemanticSyncIso(result.redditItem.fetchedAt);
  const inferredSyncAtInputValue = inferredSyncAtIso ? isoToIstInputValue(inferredSyncAtIso) : "";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncAt, setSyncAt] = useState(inferredSyncAtInputValue);
  const [isPending, startTransition] = useTransition();
  const syncAtIso = istDateTimeInputToIso(syncAt);
  const canAddToLeads = result.classificationStatus === "CLASSIFIED" && result.score !== null;
  const isManualOverride = Boolean(syncAtIso && inferredSyncAtIso && syncAtIso !== inferredSyncAtIso);

  function handleOpenAddDialog() {
    setSyncAt(inferredSyncAtInputValue);
    setDialogOpen(true);
  }

  function handleAddToLeads() {
    if (!syncAtIso) {
      toast({
        title: "Choose a valid sync timestamp",
        description: "Pick the date and time in IST before adding this result to leads.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.set("resultId", result.id);
    formData.set("syncAt", syncAtIso);

    startTransition(async () => {
      try {
        const response = await addPlaygroundResultToCampaignLead(formData);

        toast({
          title: response.status === "success" ? "Lead saved" : "Could not add lead",
          description: response.message,
          variant: response.status === "success" ? undefined : "destructive",
        });

        if (response.status === "success") {
          setDialogOpen(false);
          router.refresh();
        }
      } catch (error) {
        toast({
          title: "Could not add lead",
          description: error instanceof Error ? error.message : "The playground result could not be added to campaign leads.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <>
      <article className="rounded-[18px] border border-white/[0.06] bg-[#181818] p-4 transition-colors hover:border-white/[0.1]">
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
              <div className="mt-4 rounded-[14px] border border-white/[0.05] bg-[#111111] p-3 text-[13px] leading-5 text-[#cbcbcb]">
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

            <div className="mt-4 flex flex-wrap gap-2">
              {result.redditItem.url ? (
                <Link
                  className="inline-flex min-h-9 items-center rounded-full bg-[#1ed760] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#121212] transition-colors hover:bg-[#3be477]"
                  href={result.redditItem.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on Reddit
                </Link>
              ) : null}
              <button
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-[#111111] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffffff] transition-colors hover:bg-[#252525] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/60 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canAddToLeads}
                onClick={handleOpenAddDialog}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add to leads
              </button>
            </div>
          </div>

          <div className="w-full rounded-[16px] border border-white/[0.06] bg-[#111111] px-4 py-3 text-left sm:w-auto sm:min-w-[104px] sm:text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">LLM score</div>
            <div className="mt-2 text-[30px] font-bold leading-none text-[#ffffff]">
              {result.score ?? "-"}
            </div>
            {result.model ? <div className="mt-2 text-[10px] text-[#b3b3b3]">{result.model}</div> : null}
          </div>
        </div>
      </article>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-xl">Add result to campaign leads</DialogTitle>
            <DialogDescription>
              The sync bucket is auto-selected from the Reddit item fetched time. You can override it when backfilling.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            <div className="rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill label={`score ${result.score ?? "-"}`} tone="good" />
                <StatusPill label={`semantic ${result.bestScore.toFixed(3)}`} tone="neutral" />
                <StatusPill label={`r/${result.redditItem.subreddit}`} tone="neutral" />
              </div>
              <p className="mt-3 text-[14px] font-semibold leading-6 text-[#ffffff] [overflow-wrap:anywhere]">
                {result.redditItem.title || sourceText || "Untitled Reddit post"}
              </p>
              {result.summary ? <p className="mt-2 text-[13px] leading-5 text-[#cbcbcb]">{result.summary}</p> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[16px] bg-[#1f1f1f] px-4 py-3 shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">Fetched</p>
                <p className="mt-2 text-[13px] font-semibold leading-5 text-[#ffffff]">
                  {formatTimestamp(result.redditItem.fetchedAt, "Asia/Kolkata")} IST
                </p>
              </div>
              <div className="rounded-[16px] bg-[#12331f] px-4 py-3 shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#73f5a0]">Auto sync bucket</p>
                <p className="mt-2 text-[13px] font-semibold leading-5 text-[#ffffff]">
                  {inferredSyncAtIso ? `${formatTimestamp(inferredSyncAtIso, "Asia/Kolkata")} IST` : "Unavailable"}
                </p>
              </div>
            </div>

            <label className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Sync timestamp (IST)</span>
                {isManualOverride && inferredSyncAtInputValue ? (
                  <button
                    className="min-h-8 rounded-full bg-[#1f1f1f] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ffffff] shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525]"
                    onClick={() => setSyncAt(inferredSyncAtInputValue)}
                    type="button"
                  >
                    Reset auto
                  </button>
                ) : null}
              </div>
              <Input
                onChange={(event) => setSyncAt(event.target.value)}
                type="datetime-local"
                value={syncAt}
              />
              <span className="text-[12px] leading-5 text-[#b3b3b3]">
                Auto-selected from fetched time using the next 15:00 UTC daily semantic sync boundary (08:00 PDT / 07:00 PST).
              </span>
            </label>

            {syncAtIso ? (
              <div className="rounded-[16px] bg-[#1f1f1f] px-4 py-3 text-[12px] leading-5 text-[#cbcbcb]">
                <span className="font-semibold text-[#ffffff]">{isManualOverride ? "Override will save as:" : "Will save as:"}</span>{" "}
                {formatTimestamp(syncAtIso, "Asia/Kolkata")} IST / {formatTimestamp(syncAtIso, "UTC")} UTC
              </div>
            ) : (
              <div className="rounded-[16px] bg-[#3a151b] px-4 py-3 text-[12px] leading-5 text-[#ff9aa5]">
                Choose a valid date and time before saving.
              </div>
            )}
          </div>

          <DialogFooter className="mt-5 sm:justify-end">
            <Button disabled={isPending} onClick={() => setDialogOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              className="border-none bg-[#1ed760] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477]"
              disabled={!syncAtIso || isPending}
              onClick={handleAddToLeads}
              type="button"
            >
              {isPending ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Plus className="h-4 w-4" />}
              {isPending ? "Saving..." : "Add lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

function formatTimestamp(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
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

function istDateTimeInputToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  ) - IST_OFFSET_MINUTES * 60 * 1000;
  const normalizedLocalValue = new Date(utcMs + IST_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 16);

  if (normalizedLocalValue !== value) {
    return null;
  }

  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isoToIstInputValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 16);
}

function getInferredDailySemanticSyncIso(fetchedAt: string) {
  const source = new Date(fetchedAt);

  if (Number.isNaN(source.getTime())) {
    return null;
  }

  const boundary = new Date(Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth(),
    source.getUTCDate(),
    DAILY_SEMANTIC_CRON_UTC_HOUR,
    DAILY_SEMANTIC_CRON_UTC_MINUTE,
    0,
    0,
  ));

  if (boundary.getTime() <= source.getTime()) {
    boundary.setUTCDate(boundary.getUTCDate() + 1);
  }

  return boundary.toISOString();
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
