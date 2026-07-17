import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowLeft, Clock3, FlaskConical, Layers3, PlayCircle } from "lucide-react";

import { CopyJsonButton } from "@/components/admin/copy-json-button";
import { SemanticPlaygroundForm } from "@/components/admin/semantic-playground-form";
import { SemanticPlaygroundResults } from "@/components/admin/semantic-playground-results";
import { SemanticPlaygroundRunRefresher } from "@/components/admin/semantic-playground-run-refresher";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import {
  getPlaygroundCandidateScopeFromSnapshot,
  getPlaygroundCandidateScopeLabel,
  getPlaygroundFilteringDescriptionFromSnapshot,
  resolvePlaygroundFilteringDescription,
} from "@/lib/semantic-playground-scope";
import { semanticMatchThreshold } from "@/worker/config";

type SearchParams = {
  campaignId?: string;
  runId?: string;
};

const MAX_DISPLAYED_RESULTS = 250;
const PLAYGROUND_TOTAL_LEAD_SCORE = 50;
const PLAYGROUND_STRONG_LEAD_LABEL = "HIGH";

type PlaygroundRunLeadMetrics = {
  strongLeads: number;
  totalLeads: number;
};

export default async function AdminSemanticPlaygroundPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!canViewAnalytics(session.user.email)) {
    redirect("/app");
  }

  const params = await Promise.resolve(searchParams ?? {});
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      leadType: true,
      description: true,
      isActive: true,
      subreddits: true,
      semanticQueries: {
        select: {
          id: true,
          queryText: true,
          category: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  const selectedCampaignId =
    campaigns.find((campaign) => campaign.id === params.campaignId)?.id
    ?? campaigns[0]?.id
    ?? null;
  const defaultFetchedTo = new Date();
  const defaultFetchedFrom = new Date(defaultFetchedTo.getTime() - 24 * 60 * 60 * 1000);
  const recentRuns = selectedCampaignId
    ? await prisma.campaignSemanticPlaygroundRun.findMany({
        where: {
          campaignId: selectedCampaignId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          threshold: true,
          fetchedFrom: true,
          fetchedTo: true,
          createdAt: true,
          querySnapshot: true,
          statsJson: true,
        },
      })
    : [];
  const selectedRunId = params.runId ?? recentRuns[0]?.id ?? null;
  const selectedRun = selectedRunId
    ? await prisma.campaignSemanticPlaygroundRun.findFirst({
        where: {
          id: selectedRunId,
          ...(selectedCampaignId
            ? {
                campaignId: selectedCampaignId,
              }
            : {}),
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          threshold: true,
          fetchedFrom: true,
          fetchedTo: true,
          createdAt: true,
          queuedAt: true,
          startedAt: true,
          completedAt: true,
          failedAt: true,
          error: true,
          querySnapshot: true,
          statsJson: true,
          campaign: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          queries: {
            select: {
              id: true,
              queryText: true,
              category: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          results: {
            select: {
              id: true,
              bestScore: true,
              bestQueryText: true,
              classificationStatus: true,
              score: true,
              label: true,
              intentType: true,
              buyerStage: true,
              category: true,
              summary: true,
              painPoints: true,
              disqualifier: true,
              error: true,
              model: true,
              redditItem: {
                select: {
                  id: true,
                  subreddit: true,
                  title: true,
                  description: true,
                  body: true,
                  author: true,
                  url: true,
                  fetchedAt: true,
                  createdUtc: true,
                },
              },
            },
            orderBy: {
              bestScore: "desc",
            },
            take: MAX_DISPLAYED_RESULTS,
          },
        },
      })
    : null;
  const runIdsForLeadMetrics = Array.from(
    new Set([
      ...recentRuns.map((run) => run.id),
      ...(selectedRun?.id ? [selectedRun.id] : []),
    ]),
  );
  const [totalLeadCounts, strongLeadCounts] = runIdsForLeadMetrics.length > 0
    ? await Promise.all([
        prisma.campaignSemanticPlaygroundResult.groupBy({
          by: ["runId"],
          where: {
            classificationStatus: "CLASSIFIED",
            runId: {
              in: runIdsForLeadMetrics,
            },
            score: {
              gte: PLAYGROUND_TOTAL_LEAD_SCORE,
            },
          },
          _count: {
            _all: true,
          },
        }),
        prisma.campaignSemanticPlaygroundResult.groupBy({
          by: ["runId"],
          where: {
            classificationStatus: "CLASSIFIED",
            label: PLAYGROUND_STRONG_LEAD_LABEL,
            runId: {
              in: runIdsForLeadMetrics,
            },
          },
          _count: {
            _all: true,
          },
        }),
      ])
    : [[], []];
  const leadMetricsByRunId = buildRunLeadMetricsMap(totalLeadCounts, strongLeadCounts);
  const runStats = getStats(selectedRun?.statsJson);
  const selectedRunCandidateScope = getPlaygroundCandidateScopeFromSnapshot(selectedRun?.querySnapshot);
  const selectedRunSnapshotDescription = getPlaygroundFilteringDescriptionFromSnapshot(selectedRun?.querySnapshot);
  const selectedRunFilteringDescription = resolvePlaygroundFilteringDescription(
    selectedRun?.querySnapshot,
    selectedRun?.campaign.description,
  );
  const selectedRunLeadMetrics = getRunLeadMetrics(leadMetricsByRunId, selectedRun?.id);
  const isRunActive = selectedRun?.status === "QUEUED" || selectedRun?.status === "PROCESSING";

  return (
    <div className="space-y-6 text-[#ffffff]">
      <SemanticPlaygroundRunRefresher active={isRunActive} />

      <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[linear-gradient(135deg,#1b1b1b_0%,#151515_58%,#102118_100%)] px-5 py-6 shadow-[rgba(0,0,0,0.28)_0px_12px_32px] lg:px-7 lg:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <Link
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-black/20 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#b3b3b3] transition-colors hover:bg-white/[0.06] hover:text-[#ffffff]"
              href="/admin/analytics"
            >
              <ArrowLeft className="h-4 w-4" />
              Analytics
            </Link>
            <div className="mt-5 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#1ed760]/12 text-[#55e982] shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset]">
                <FlaskConical className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#73f5a0]">Semantic testing</p>
                <h1 className="mt-2 text-[1.85rem] font-bold tracking-[-0.03em] text-[#ffffff] lg:text-[2.25rem]">Playground</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-[14px] leading-6 text-[#b8b8b8]">
              Test draft semantic queries against already embedded Reddit posts, then manually promote useful classified results into campaign leads.
            </p>
          </div>
          <div className="grid gap-3 rounded-[20px] border border-white/[0.07] bg-black/20 p-4 sm:grid-cols-3 lg:min-w-[440px]">
            <Metric compact label="Campaigns" value={String(campaigns.length)} />
            <Metric compact label="Default min score" value={semanticMatchThreshold.toFixed(2)} />
            <Metric compact label="Recent runs" value={String(recentRuns.length)} />
          </div>
        </div>

        <div className="mt-6 grid gap-2 border-t border-white/[0.07] pt-5 sm:grid-cols-3">
          <WorkflowStep icon={<Layers3 className="h-4 w-4" />} label="Configure" number="01" text="Choose campaign, scope, and query set." />
          <WorkflowStep icon={<PlayCircle className="h-4 w-4" />} label="Run" number="02" text="Match and classify embedded Reddit posts." />
          <WorkflowStep icon={<Activity className="h-4 w-4" />} label="Review" number="03" text="Inspect scores and promote qualified leads." />
        </div>
      </section>

      <SemanticPlaygroundForm
        campaigns={campaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          leadType: campaign.leadType,
          description: campaign.description,
          isActive: campaign.isActive,
          subreddits: campaign.subreddits,
          semanticQueries: campaign.semanticQueries,
        }))}
        defaultFetchedFrom={defaultFetchedFrom.toISOString()}
        defaultFetchedTo={defaultFetchedTo.toISOString()}
        defaultThreshold={semanticMatchThreshold}
        key={selectedCampaignId}
        selectedCampaignId={selectedCampaignId}
      />

      {recentRuns.length > 0 ? (
        <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.22)_0px_10px_28px] lg:p-5">
          <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#242424] text-[#d4d4d8]">
                <Clock3 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-[#ffffff]">Recent runs</h2>
                <p className="mt-1 text-[12px] leading-5 text-[#8f8f8f]">Compare the last eight tests for the selected campaign.</p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {recentRuns.map((run) => {
              const stats = getStats(run.statsJson);
              const candidateScope = getPlaygroundCandidateScopeFromSnapshot(run.querySnapshot);
              const filteringDescription = getPlaygroundFilteringDescriptionFromSnapshot(run.querySnapshot);
              const leadMetrics = getRunLeadMetrics(leadMetricsByRunId, run.id);

              return (
                <Link
                  className={`group rounded-[18px] border p-4 transition-colors ${
                    selectedRun?.id === run.id
                      ? "border-[#1ed760]/40 bg-[#1ed760]/[0.055]"
                      : "border-white/[0.06] bg-[#111111] hover:border-white/[0.12] hover:bg-[#171717]"
                  }`}
                  href={`/admin/analytics/playground?campaignId=${encodeURIComponent(selectedCampaignId ?? "")}&runId=${encodeURIComponent(run.id)}`}
                  key={run.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <StatusPill label={run.status.toLowerCase()} tone={statusTone(run.status)} />
                    <span className="text-[10px] font-medium text-[#737373]">{formatDate(run.createdAt)}</span>
                  </div>
                  <h3 className="mt-3 truncate text-[15px] font-bold text-[#ffffff]">{getRunTitle(run.title)}</h3>
                  <p className="mt-1 line-clamp-2 min-h-10 text-[12px] leading-5 text-[#8f8f8f]">
                    {filteringDescription ?? "Legacy run used the campaign description."}
                  </p>
                  <p className="mt-3 text-[11px] leading-5 text-[#a1a1aa]">{formatDateRange(run.fetchedFrom, run.fetchedTo)}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MiniMetric label="Semantic" value={String(getStat(stats, "semanticMatches"))} />
                    <MiniMetric label="Classified" value={String(getStat(stats, "classified"))} />
                    <MiniMetric label="Total leads" value={String(leadMetrics.totalLeads)} />
                    <MiniMetric label="Strong" value={String(leadMetrics.strongLeads)} />
                  </div>
                  <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                    {getPlaygroundCandidateScopeLabel(candidateScope)} / Min semantic {run.threshold.toFixed(2)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {selectedRun ? (
        <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.22)_0px_10px_28px] lg:p-5">
          <div className="flex flex-col gap-5 border-b border-white/[0.06] pb-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill label={selectedRun.status.toLowerCase()} tone={statusTone(selectedRun.status)} />
                <StatusPill label={`min ${selectedRun.threshold.toFixed(2)}`} tone="neutral" />
                <StatusPill label={`${selectedRun.queries.length} queries`} tone="neutral" />
                <StatusPill label={getPlaygroundCandidateScopeLabel(selectedRunCandidateScope)} tone="neutral" />
              </div>
              <h2 className="mt-4 text-[22px] font-bold tracking-[-0.02em] text-[#ffffff]">{getRunTitle(selectedRun.title)}</h2>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f8f8f]">
                LLM filtering description{selectedRunSnapshotDescription ? "" : " / campaign fallback"}
              </p>
              <p className="mt-1 text-[14px] leading-6 text-[#cbcbcb]">
                {selectedRunFilteringDescription ?? "No campaign description was available for this run."}
              </p>
              <p className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">
                {selectedRun.campaign.name} - {" "}
                {formatDateRange(selectedRun.fetchedFrom, selectedRun.fetchedTo)}
              </p>
              {selectedRun.error ? (
                <p className="mt-3 rounded-[16px] bg-[#3a151b] px-4 py-3 text-[13px] leading-5 text-[#ff9aa5] shadow-[rgb(243,114,127)_0px_0px_0px_1px_inset]">
                  {selectedRun.error}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[570px]">
              <Metric label="Candidates" value={String(getStat(runStats, "candidatePosts"))} />
              <Metric label="Semantic matches" value={String(getStat(runStats, "semanticMatches"))} />
              <Metric label="Classified" value={String(getStat(runStats, "classified"))} />
              <Metric label="Total leads" value={String(selectedRunLeadMetrics.totalLeads)} />
              <Metric label="Strong leads" value={String(selectedRunLeadMetrics.strongLeads)} />
              <Metric label="Failed" value={String(getStat(runStats, "classificationFailed"))} />
            </div>
          </div>

          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="flex max-h-[72dvh] min-h-0 flex-col overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#111111] p-4 xl:sticky xl:top-4">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Run queries</p>
                <CopyJsonButton
                  className="min-h-9 rounded-full bg-[#1f1f1f] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ffffff] shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525]"
                  label="Copy JSON"
                  payload={{
                    campaignId: selectedRun.campaign.id,
                    campaignName: selectedRun.campaign.name,
                    candidateScope: selectedRunCandidateScope,
                    filteringDescription: selectedRunFilteringDescription,
                    fetchedFrom: selectedRun.fetchedFrom.toISOString(),
                    fetchedTo: selectedRun.fetchedTo.toISOString(),
                    runCreatedAt: selectedRun.createdAt.toISOString(),
                    runId: selectedRun.id,
                    title: selectedRun.title,
                    semanticQueries: selectedRun.queries.map((query, index) => ({
                      category: query.category ?? null,
                      id: query.id,
                      index: index + 1,
                      queryText: query.queryText,
                    })),
                    threshold: selectedRun.threshold,
                  }}
                />
              </div>
              <div className="mt-4 grid min-h-0 flex-1 gap-2 overflow-y-auto overscroll-contain pr-1">
                {selectedRun.queries.map((query, index) => (
                  <div className="rounded-[14px] border border-white/[0.05] bg-[#181818] p-3" key={query.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1ed760]">Query {index + 1}</span>
                      {query.category ? (
                        <span className="rounded-full bg-[#121212] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#cbcbcb]">
                          {query.category}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[13px] leading-5 text-[#cbcbcb]">{query.queryText}</p>
                  </div>
                ))}
              </div>
            </div>

            <SemanticPlaygroundResults
              isRunActive={isRunActive}
              progress={{
                candidatePosts: getStat(runStats, "candidatePosts"),
                classificationFailed: getStat(runStats, "classificationFailed"),
                classified: getStat(runStats, "classified"),
                semanticMatches: getStat(runStats, "semanticMatches"),
              }}
              results={selectedRun.results.map((result) => ({
                ...result,
                redditItem: {
                  ...result.redditItem,
                  createdUtc: result.redditItem.createdUtc.toISOString(),
                  fetchedAt: result.redditItem.fetchedAt.toISOString(),
                },
              }))}
              runStatus={selectedRun.status}
              totalMatches={getStat(runStats, "semanticMatches")}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ compact = false, label, value }: { compact?: boolean; label: string; value: string }) {
  return (
    <div className={`rounded-[16px] border border-white/[0.06] bg-[#111111] px-4 py-3 ${compact ? "border-0 bg-transparent px-0 py-0" : ""}`}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8f8f8f]">{label}</p>
      <p className="mt-2 text-[1.4rem] font-bold leading-none tracking-[-0.03em] text-[#ffffff]">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-white/[0.05] bg-black/20 px-3 py-2">
      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</p>
      <p className="mt-1 text-[15px] font-bold leading-none text-[#f4f4f5]">{value}</p>
    </div>
  );
}

function WorkflowStep({
  icon,
  label,
  number,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  number: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[16px] border border-white/[0.06] bg-black/15 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.06] text-[#73f5a0]">{icon}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black tracking-[0.12em] text-[#55e982]">{number}</span>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f4f4f5]">{label}</p>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[#8f8f8f]">{text}</p>
      </div>
    </div>
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

function getStats(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getStat(stats: Record<string, unknown>, key: string) {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildRunLeadMetricsMap(
  totalLeadCounts: Array<{ runId: string; _count: { _all: number } }>,
  strongLeadCounts: Array<{ runId: string; _count: { _all: number } }>,
) {
  const metrics = new Map<string, PlaygroundRunLeadMetrics>();

  for (const row of totalLeadCounts) {
    metrics.set(row.runId, {
      strongLeads: 0,
      totalLeads: row._count._all,
    });
  }

  for (const row of strongLeadCounts) {
    const current = getRunLeadMetrics(metrics, row.runId);
    metrics.set(row.runId, {
      ...current,
      strongLeads: row._count._all,
    });
  }

  return metrics;
}

function getRunLeadMetrics(metrics: Map<string, PlaygroundRunLeadMetrics>, runId: string | null | undefined) {
  return runId
    ? metrics.get(runId) ?? { strongLeads: 0, totalLeads: 0 }
    : { strongLeads: 0, totalLeads: 0 };
}

function getRunTitle(title: string | null) {
  return title?.trim() || "Untitled playground run";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatDateRange(from: Date, to: Date) {
  return `${formatDate(from)} - ${formatDate(to)}`;
}
