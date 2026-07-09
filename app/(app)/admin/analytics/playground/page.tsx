import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FlaskConical } from "lucide-react";

import { CopyJsonButton } from "@/components/admin/copy-json-button";
import { SemanticPlaygroundForm } from "@/components/admin/semantic-playground-form";
import { SemanticPlaygroundResults } from "@/components/admin/semantic-playground-results";
import { SemanticPlaygroundRunRefresher } from "@/components/admin/semantic-playground-run-refresher";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
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
          status: true,
          threshold: true,
          fetchedFrom: true,
          fetchedTo: true,
          createdAt: true,
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
          statsJson: true,
          campaign: {
            select: {
              id: true,
              name: true,
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
  const selectedRunLeadMetrics = getRunLeadMetrics(leadMetricsByRunId, selectedRun?.id);
  const isRunActive = selectedRun?.status === "QUEUED" || selectedRun?.status === "PROCESSING";

  return (
    <div className="space-y-5 text-[#ffffff]">
      <SemanticPlaygroundRunRefresher active={isRunActive} />

      <section className="rounded-[24px] bg-[#181818] px-5 py-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:px-6 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <Link
              className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#121212] px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525] hover:text-[#ffffff]"
              href="/admin/analytics"
            >
              <ArrowLeft className="h-4 w-4" />
              Admin
            </Link>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Admin analytics</p>
            <h1 className="mt-2 flex items-center gap-3 text-[1.85rem] font-bold text-[#ffffff] lg:text-[2.2rem]">
              <FlaskConical className="h-7 w-7 text-[#1ed760]" />
              Playground
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">
              Test draft semantic queries against already embedded Reddit posts without changing campaign queries, leads, or daily semantic reports.
            </p>
          </div>
          <div className="grid gap-2 rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:grid-cols-3 lg:min-w-[420px]">
            <Metric compact label="Campaigns" value={String(campaigns.length)} />
            <Metric compact label="Default min score" value={semanticMatchThreshold.toFixed(2)} />
            <Metric compact label="Recent runs" value={String(recentRuns.length)} />
          </div>
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
        <section className="flex max-h-[54dvh] min-h-0 flex-col overflow-hidden rounded-[24px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-5">
          <div className="flex shrink-0 flex-col gap-3 border-b border-[#27272a] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">History</p>
              <h2 className="mt-2 text-[17px] font-bold text-[#ffffff]">Recent playground runs</h2>
            </div>
          </div>
          <div className="mt-4 grid min-h-0 flex-1 gap-2 overflow-y-auto overscroll-contain pr-1 md:grid-cols-2 xl:grid-cols-4">
            {recentRuns.map((run) => {
              const stats = getStats(run.statsJson);
              const leadMetrics = getRunLeadMetrics(leadMetricsByRunId, run.id);

              return (
                <Link
                  className={`rounded-[16px] border px-4 py-3 transition-colors ${
                    selectedRun?.id === run.id
                      ? "border-[#1ed760]/40 bg-[#1f1f1f] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
                      : "border-transparent bg-[#121212] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] hover:bg-[#1f1f1f]"
                  }`}
                  href={`/admin/analytics/playground?campaignId=${encodeURIComponent(selectedCampaignId ?? "")}&runId=${encodeURIComponent(run.id)}`}
                  key={run.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <StatusPill label={run.status.toLowerCase()} tone={statusTone(run.status)} />
                    <span className="text-[11px] font-semibold text-[#b3b3b3]">{formatDate(run.createdAt)}</span>
                  </div>
                  <p className="mt-3 text-[12px] leading-5 text-[#cbcbcb]">{formatDateRange(run.fetchedFrom, run.fetchedTo)}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MiniMetric label="Semantic" value={String(getStat(stats, "semanticMatches"))} />
                    <MiniMetric label="Classified" value={String(getStat(stats, "classified"))} />
                    <MiniMetric label="Total leads" value={String(leadMetrics.totalLeads)} />
                    <MiniMetric label="Strong" value={String(leadMetrics.strongLeads)} />
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f8f8f]">
                    Min semantic {run.threshold.toFixed(2)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {selectedRun ? (
        <section className="rounded-[24px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-5">
          <div className="flex flex-col gap-4 border-b border-[#27272a] pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill label={selectedRun.status.toLowerCase()} tone={statusTone(selectedRun.status)} />
                <StatusPill label={`min ${selectedRun.threshold.toFixed(2)}`} tone="neutral" />
                <StatusPill label={`${selectedRun.queries.length} queries`} tone="neutral" />
              </div>
              <h2 className="mt-4 text-[22px] font-bold tracking-tight text-[#ffffff]">{selectedRun.campaign.name}</h2>
              <p className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">
                {formatDateRange(selectedRun.fetchedFrom, selectedRun.fetchedTo)}
              </p>
              {selectedRun.error ? (
                <p className="mt-3 rounded-[16px] bg-[#3a151b] px-4 py-3 text-[13px] leading-5 text-[#ff9aa5] shadow-[rgb(243,114,127)_0px_0px_0px_1px_inset]">
                  {selectedRun.error}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 xl:min-w-[560px]">
              <Metric label="Candidates" value={String(getStat(runStats, "candidatePosts"))} />
              <Metric label="Semantic matches" value={String(getStat(runStats, "semanticMatches"))} />
              <Metric label="Classified" value={String(getStat(runStats, "classified"))} />
              <Metric label="Total leads" value={String(selectedRunLeadMetrics.totalLeads)} />
              <Metric label="Strong leads" value={String(selectedRunLeadMetrics.strongLeads)} />
              <Metric label="Failed" value={String(getStat(runStats, "classificationFailed"))} />
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
            <div className="flex max-h-[60dvh] min-h-0 flex-col overflow-hidden rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] xl:max-h-[calc(100dvh-12rem)]">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Run queries</p>
                <CopyJsonButton
                  className="min-h-9 rounded-full bg-[#1f1f1f] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ffffff] shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525]"
                  label="Copy JSON"
                  payload={{
                    campaignId: selectedRun.campaign.id,
                    campaignName: selectedRun.campaign.name,
                    fetchedFrom: selectedRun.fetchedFrom.toISOString(),
                    fetchedTo: selectedRun.fetchedTo.toISOString(),
                    runCreatedAt: selectedRun.createdAt.toISOString(),
                    runId: selectedRun.id,
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
              <div className="mt-4 grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain pr-1">
                {selectedRun.queries.map((query, index) => (
                  <div className="rounded-[14px] bg-[#1f1f1f] p-3" key={query.id}>
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
    <div className={`rounded-[16px] bg-[#1f1f1f] px-4 py-3 ${compact ? "bg-transparent px-0 py-0" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">{label}</p>
      <p className="mt-2 text-[1.45rem] font-bold leading-none text-[#ffffff]">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-[#1f1f1f] px-3 py-2 shadow-[rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8f8f8f]">{label}</p>
      <p className="mt-1 text-[16px] font-bold leading-none text-[#ffffff]">{value}</p>
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatDateRange(from: Date, to: Date) {
  return `${formatDate(from)} - ${formatDate(to)}`;
}
