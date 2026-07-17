import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Award,
  ExternalLink,
  GitCompareArrows,
  Trophy,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import {
  analyzePlaygroundRunComparison,
  type PlaygroundComparisonMembership,
  type PlaygroundComparisonPairwiseOverlap,
  type PlaygroundComparisonRunMetrics,
} from "@/lib/playground-run-comparison";
import { prisma } from "@/lib/prisma";
import {
  getPlaygroundCandidateScopeFromSnapshot,
  getPlaygroundCandidateScopeLabel,
  resolvePlaygroundFilteringDescription,
} from "@/lib/semantic-playground-scope";

type SearchParams = {
  runIds?: string;
};

type ComparisonRedditItem = {
  author: string | null;
  body: string | null;
  createdUtc: Date;
  description: string | null;
  fetchedAt: Date;
  id: string;
  subreddit: string;
  title: string | null;
  url: string | null;
};

type ComparisonResult = {
  bestQueryText: string | null;
  bestScore: number;
  classificationStatus: string;
  label: string | null;
  redditItem: ComparisonRedditItem;
  redditItemId: string;
  score: number | null;
  summary: string | null;
};

type ComparisonRun = {
  campaign: {
    description: string | null;
    id: string;
    name: string;
  };
  campaignId: string;
  completedAt: Date | null;
  createdAt: Date;
  fetchedFrom: Date;
  fetchedTo: Date;
  id: string;
  queries: Array<{
    category: string | null;
    id: string;
    queryText: string;
  }>;
  querySnapshot: unknown;
  results: ComparisonResult[];
  status: string;
  threshold: number;
  title: string | null;
};

export default async function PlaygroundRunComparisonPage({
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
  const requestedRunIds = parseRunIds(params.runIds);

  if (requestedRunIds.length < 2 || requestedRunIds.length > 4) {
    return (
      <ComparisonError
        message="Select between two and four completed playground runs."
      />
    );
  }

  const fetchedRuns = await prisma.campaignSemanticPlaygroundRun.findMany({
    where: {
      id: {
        in: requestedRunIds,
      },
    },
    select: {
      id: true,
      campaignId: true,
      title: true,
      status: true,
      threshold: true,
      fetchedFrom: true,
      fetchedTo: true,
      querySnapshot: true,
      completedAt: true,
      createdAt: true,
      campaign: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      queries: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          category: true,
          queryText: true,
        },
      },
      results: {
        select: {
          redditItemId: true,
          bestScore: true,
          bestQueryText: true,
          classificationStatus: true,
          score: true,
          label: true,
          summary: true,
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
      },
    },
  });

  if (fetchedRuns.length !== requestedRunIds.length) {
    return <ComparisonError message="One or more selected playground runs no longer exist." />;
  }

  const orderedRuns = requestedRunIds
    .map((runId) => fetchedRuns.find((run) => run.id === runId))
    .filter((run): run is NonNullable<typeof run> => Boolean(run)) as ComparisonRun[];
  const campaignIds = new Set(orderedRuns.map((run) => run.campaignId));

  if (campaignIds.size !== 1) {
    return <ComparisonError message="Playground comparisons must use runs from the same campaign." />;
  }

  if (orderedRuns.some((run) => run.status !== "COMPLETED")) {
    return <ComparisonError campaignId={orderedRuns[0]?.campaignId} message="Only completed playground runs can be compared." />;
  }

  const analysis = analyzePlaygroundRunComparison(
    orderedRuns.map((run) => ({
      id: run.id,
      results: run.results.map((result) => ({
        bestScore: result.bestScore,
        classificationStatus: result.classificationStatus,
        label: result.label,
        redditItemId: result.redditItemId,
        score: result.score,
      })),
    })),
  );
  const campaign = orderedRuns[0].campaign;
  const runIndexById = new Map(orderedRuns.map((run, index) => [run.id, index]));
  const runById = new Map(orderedRuns.map((run) => [run.id, run]));
  const metricsByRunId = new Map(analysis.runMetrics.map((metric) => [metric.runId, metric]));
  const membershipByItemId = new Map(analysis.memberships.map((membership) => [membership.redditItemId, membership]));
  const resultByRunAndItem = new Map(
    orderedRuns.map((run) => [run.id, new Map(run.results.map((result) => [result.redditItemId, result]))]),
  );
  const redditItemById = new Map<string, ComparisonRedditItem>();

  for (const run of orderedRuns) {
    for (const result of run.results) {
      redditItemById.set(result.redditItemId, result.redditItem);
    }
  }

  const warnings = getConfigurationWarnings(orderedRuns);
  const commonStrongToAll = analysis.memberships.filter((membership) =>
    membership.strongRunIds.length === orderedRuns.length,
  ).length;
  const qualifiedUnion = analysis.memberships.filter((membership) => membership.qualifiedRunIds.length > 0).length;
  const winnerRuns = analysis.winnerRunIds.map((runId) => runById.get(runId)).filter(Boolean) as ComparisonRun[];
  const backHref = `/admin/analytics/playground?campaignId=${encodeURIComponent(campaign.id)}`;

  return (
    <div className="space-y-6 text-[#ffffff]">
      <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[linear-gradient(135deg,#1b1b1b_0%,#151515_58%,#102118_100%)] px-5 py-6 shadow-[rgba(0,0,0,0.28)_0px_12px_32px] lg:px-7 lg:py-7">
        <Link
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-black/20 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#b3b3b3] transition-colors hover:bg-white/[0.06] hover:text-[#ffffff]"
          href={backHref}
        >
          <ArrowLeft className="h-4 w-4" />
          Playground
        </Link>
        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#1ed760]/12 text-[#55e982] shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset]">
                <GitCompareArrows className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#73f5a0]">Run comparison</p>
                <h1 className="mt-2 text-[1.85rem] font-bold tracking-[-0.03em] text-[#ffffff] lg:text-[2.25rem]">{campaign.name}</h1>
              </div>
            </div>
            <p className="mt-4 text-[14px] leading-6 text-[#b8b8b8]">
              Comparing {orderedRuns.length} completed configurations using exact Reddit-item overlap and qualified leads scoring 50 or higher.
            </p>
          </div>
          <div className="grid min-w-full gap-3 sm:grid-cols-3 xl:min-w-[480px]">
            <HeaderMetric label="Qualified union" value={qualifiedUnion} />
            <HeaderMetric label="Common to all" value={analysis.commonToAllQualifiedIds.length} />
            <HeaderMetric label="Strong in all" value={commonStrongToAll} />
          </div>
        </div>
      </section>

      <section className={`rounded-[24px] border p-5 ${winnerRuns.length === 1 ? "border-[#1ed760]/25 bg-[#12331f]/70" : "border-[#f2c94c]/25 bg-[#3b2d10]/70"}`}>
        <div className="flex items-start gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${winnerRuns.length === 1 ? "bg-[#1ed760] text-[#0d160f]" : "bg-[#f2c94c] text-[#221b07]"}`}>
            {winnerRuns.length === 1 ? <Trophy className="h-5 w-5" /> : <Award className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b8b8b8]">Strong-first result</p>
            <h2 className="mt-2 text-[20px] font-bold text-[#ffffff]">
              {winnerRuns.length === 1
                ? `${getRunName(winnerRuns[0], runIndexById)} performed best`
                : `Tie between ${winnerRuns.map((run) => getRunName(run, runIndexById)).join(", ")}`}
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-[#d4d4d8]">
              Ranked by HIGH leads first, then qualified leads, then average score among qualified leads.
            </p>
          </div>
        </div>
      </section>

      {warnings.length > 0 ? (
        <section className="rounded-[20px] border border-[#f2c94c]/25 bg-[#3b2d10]/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffd66e]">Comparison context differs</p>
          <ul className="mt-2 grid gap-1 text-[12px] leading-5 text-[#e7d9a6]">
            {warnings.map((warning) => <li key={warning}>• {warning}</li>)}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
        {orderedRuns.map((run) => {
          const metrics = metricsByRunId.get(run.id) ?? emptyMetrics(run.id);
          const winner = analysis.winnerRunIds.includes(run.id);

          return (
            <RunScorecard
              key={run.id}
              metrics={metrics}
              name={getRunName(run, runIndexById)}
              run={run}
              winner={winner}
            />
          );
        })}
      </section>

      <Section title="Configuration comparison" description="Review the exact descriptions, scopes, windows, thresholds, and query sets behind each result.">
        <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
          {orderedRuns.map((run) => (
            <ConfigurationCard key={run.id} name={getRunName(run, runIndexById)} run={run} />
          ))}
        </div>
      </Section>

      <section className="grid gap-5 2xl:grid-cols-2">
        <Section title="Qualified-lead overlap" description="Pairwise overlap for classified leads scoring 50 or higher.">
          <PairwiseTable pairs={analysis.pairwiseQualified} runById={runById} runIndexById={runIndexById} />
        </Section>
        <Section title="Semantic-match overlap" description="Pairwise overlap before the LLM score threshold is applied.">
          <PairwiseTable pairs={analysis.pairwiseSemantic} runById={runById} runIndexById={runIndexById} />
        </Section>
      </section>

      <Section
        title="Common to every run"
        description="These Reddit items qualified as leads in every selected configuration."
      >
        <LeadGrid
          itemIds={analysis.commonToAllQualifiedIds}
          membershipByItemId={membershipByItemId}
          redditItemById={redditItemById}
          resultByRunAndItem={resultByRunAndItem}
          runIndexById={runIndexById}
          runs={orderedRuns}
        />
      </Section>

      {analysis.partialQualifiedGroups.length > 0 ? (
        <Section
          title="Shared by some runs"
          description="Partial intersections grouped by the exact configurations where each lead qualified."
        >
          <div className="grid gap-4">
            {analysis.partialQualifiedGroups.map((group) => (
              <LeadSubsection
                description={`${group.redditItemIds.length} lead${group.redditItemIds.length === 1 ? "" : "s"} qualified in this exact run combination.`}
                itemIds={group.redditItemIds}
                key={group.runIds.join("|")}
                membershipByItemId={membershipByItemId}
                redditItemById={redditItemById}
                resultByRunAndItem={resultByRunAndItem}
                runIndexById={runIndexById}
                runs={orderedRuns}
                title={group.runIds.map((runId) => getRunName(runById.get(runId), runIndexById)).join(" + ")}
              />
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        title="Unique leads by run"
        description="Each section contains leads that qualified in exactly one selected run."
      >
        <div className="grid gap-4">
          {orderedRuns.map((run) => {
            const itemIds = analysis.uniqueQualifiedIdsByRunId[run.id] ?? [];

            return (
              <LeadSubsection
                description={`${itemIds.length} lead${itemIds.length === 1 ? "" : "s"} qualified only in this run. Items may still have appeared below score 50 elsewhere.`}
                itemIds={itemIds}
                key={run.id}
                membershipByItemId={membershipByItemId}
                redditItemById={redditItemById}
                resultByRunAndItem={resultByRunAndItem}
                runIndexById={runIndexById}
                runs={orderedRuns}
                title={getRunName(run, runIndexById)}
              />
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function ComparisonError({ campaignId, message }: { campaignId?: string; message: string }) {
  const href = campaignId
    ? `/admin/analytics/playground?campaignId=${encodeURIComponent(campaignId)}`
    : "/admin/analytics/playground";

  return (
    <section className="rounded-[24px] border border-[#f3727f]/25 bg-[#3a151b] p-6 text-[#ffffff]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ff9aa5]">Comparison unavailable</p>
      <h1 className="mt-2 text-[22px] font-bold">Review the selected runs</h1>
      <p className="mt-3 text-[14px] leading-6 text-[#f7c2c8]">{message}</p>
      <Link className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#ffffff] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#181818]" href={href}>
        <ArrowLeft className="h-4 w-4" />
        Return to playground
      </Link>
    </section>
  );
}

function HeaderMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-black/20 px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8f8f8f]">{label}</p>
      <p className="mt-2 text-[1.45rem] font-bold leading-none tracking-[-0.03em] text-[#ffffff]">{value}</p>
    </div>
  );
}

function RunScorecard({
  metrics,
  name,
  run,
  winner,
}: {
  metrics: PlaygroundComparisonRunMetrics;
  name: string;
  run: ComparisonRun;
  winner: boolean;
}) {
  return (
    <article className={`rounded-[20px] border p-4 ${winner ? "border-[#1ed760]/35 bg-[#1ed760]/[0.055]" : "border-white/[0.06] bg-[#181818]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#73f5a0]">{name}</p>
          <h2 className="mt-2 truncate text-[15px] font-bold text-[#ffffff]">{getRunTitle(run.title)}</h2>
          <p className="mt-1 text-[11px] text-[#737373]">{formatDate(run.createdAt)}</p>
        </div>
        {winner ? <span className="rounded-full bg-[#1ed760] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#0d160f]">Best</span> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <SmallMetric label="Semantic" value={metrics.semanticMatches} />
        <SmallMetric label="Classified" value={metrics.classified} />
        <SmallMetric label="Qualified 50+" value={metrics.qualifiedLeads} />
        <SmallMetric label="Strong" value={metrics.strongLeads} />
        <SmallMetric label="Unique" value={metrics.uniqueQualifiedLeads} />
        <SmallMetric label="Average score" value={metrics.averageQualifiedScore.toFixed(1)} />
      </div>
      <div className="mt-3 rounded-[12px] border border-white/[0.05] bg-black/20 px-3 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Qualification rate</p>
        <p className="mt-1 text-[14px] font-bold text-[#d4d4d8]">{metrics.qualificationRate.toFixed(1)}%</p>
      </div>
    </article>
  );
}

function ConfigurationCard({ name, run }: { name: string; run: ComparisonRun }) {
  const scope = getPlaygroundCandidateScopeLabel(getPlaygroundCandidateScopeFromSnapshot(run.querySnapshot));
  const filteringDescription = resolvePlaygroundFilteringDescription(run.querySnapshot, run.campaign.description);

  return (
    <article className="rounded-[18px] border border-white/[0.06] bg-[#111111] p-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#73f5a0]">{name}</p>
      <h3 className="mt-2 text-[14px] font-bold text-[#ffffff]">{getRunTitle(run.title)}</h3>
      <dl className="mt-4 grid gap-3 text-[12px]">
        <ConfigRow label="Scope" value={scope} />
        <ConfigRow label="Threshold" value={run.threshold.toFixed(2)} />
        <ConfigRow label="Fetched window" value={formatDateRange(run.fetchedFrom, run.fetchedTo)} />
        <ConfigRow label="Queries" value={String(run.queries.length)} />
      </dl>
      <div className="mt-4 rounded-[13px] border border-white/[0.05] bg-[#181818] p-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#737373]">LLM filtering description</p>
        <p className="mt-2 text-[12px] leading-5 text-[#b3b3b3]">{filteringDescription ?? "No description"}</p>
      </div>
      <details className="mt-3 rounded-[13px] border border-white/[0.05] bg-[#181818]">
        <summary className="cursor-pointer px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#d4d4d8]">View query set</summary>
        <div className="grid gap-2 border-t border-white/[0.05] p-3">
          {run.queries.map((query, index) => (
            <div className="rounded-[10px] bg-[#111111] p-2.5" key={query.id}>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#73f5a0]">Query {index + 1}{query.category ? ` / ${query.category}` : ""}</p>
              <p className="mt-1 text-[11px] leading-4 text-[#a1a1aa]">{query.queryText}</p>
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}

function PairwiseTable({
  pairs,
  runById,
  runIndexById,
}: {
  pairs: PlaygroundComparisonPairwiseOverlap[];
  runById: Map<string, ComparisonRun>;
  runIndexById: Map<string, number>;
}) {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-white/[0.06]">
      <table className="min-w-[680px] w-full border-collapse text-left text-[11px]">
        <thead className="bg-[#111111] text-[9px] font-bold uppercase tracking-[0.12em] text-[#737373]">
          <tr>
            <th className="px-3 py-3">Run pair</th>
            <th className="px-3 py-3">Shared</th>
            <th className="px-3 py-3">First run</th>
            <th className="px-3 py-3">Second run</th>
            <th className="px-3 py-3">Jaccard</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06] bg-[#181818]">
          {pairs.map((pair) => (
            <tr key={`${pair.leftRunId}:${pair.rightRunId}`}>
              <td className="px-3 py-3 font-semibold text-[#f4f4f5]">
                {getRunName(runById.get(pair.leftRunId), runIndexById)} ↔ {getRunName(runById.get(pair.rightRunId), runIndexById)}
              </td>
              <td className="px-3 py-3 font-bold text-[#73f5a0]">{pair.sharedCount}</td>
              <td className="px-3 py-3 text-[#a1a1aa]">{pair.leftPercent.toFixed(1)}% of {pair.leftCount}</td>
              <td className="px-3 py-3 text-[#a1a1aa]">{pair.rightPercent.toFixed(1)}% of {pair.rightCount}</td>
              <td className="px-3 py-3 text-[#d4d4d8]">{pair.jaccardPercent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.22)_0px_10px_28px] lg:p-5">
      <div className="border-b border-white/[0.06] pb-4">
        <h2 className="text-[16px] font-bold text-[#ffffff]">{title}</h2>
        <p className="mt-1 text-[12px] leading-5 text-[#8f8f8f]">{description}</p>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function LeadSubsection({
  description,
  itemIds,
  membershipByItemId,
  redditItemById,
  resultByRunAndItem,
  runIndexById,
  runs,
  title,
}: {
  description: string;
  itemIds: string[];
  membershipByItemId: Map<string, PlaygroundComparisonMembership>;
  redditItemById: Map<string, ComparisonRedditItem>;
  resultByRunAndItem: Map<string, Map<string, ComparisonResult>>;
  runIndexById: Map<string, number>;
  runs: ComparisonRun[];
  title: string;
}) {
  return (
    <details className="rounded-[18px] border border-white/[0.06] bg-[#111111]" open>
      <summary className="cursor-pointer px-4 py-3.5">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <span className="block text-[13px] font-bold text-[#ffffff]">{title}</span>
            <span className="mt-1 block text-[11px] leading-4 text-[#8f8f8f]">{description}</span>
          </span>
          <span className="rounded-full bg-[#242424] px-2.5 py-1 text-[10px] font-bold text-[#d4d4d8]">{itemIds.length}</span>
        </span>
      </summary>
      <div className="border-t border-white/[0.06] p-3 sm:p-4">
        <LeadGrid
          itemIds={itemIds}
          membershipByItemId={membershipByItemId}
          redditItemById={redditItemById}
          resultByRunAndItem={resultByRunAndItem}
          runIndexById={runIndexById}
          runs={runs}
        />
      </div>
    </details>
  );
}

function LeadGrid({
  itemIds,
  membershipByItemId,
  redditItemById,
  resultByRunAndItem,
  runIndexById,
  runs,
}: {
  itemIds: string[];
  membershipByItemId: Map<string, PlaygroundComparisonMembership>;
  redditItemById: Map<string, ComparisonRedditItem>;
  resultByRunAndItem: Map<string, Map<string, ComparisonResult>>;
  runIndexById: Map<string, number>;
  runs: ComparisonRun[];
}) {
  if (itemIds.length === 0) {
    return <div className="rounded-[16px] border border-dashed border-white/[0.1] bg-[#111111] p-4 text-[12px] text-[#8f8f8f]">No leads in this group.</div>;
  }

  return (
    <div className="grid gap-3">
      {itemIds.map((itemId) => {
        const redditItem = redditItemById.get(itemId);
        const membership = membershipByItemId.get(itemId);

        if (!redditItem || !membership) {
          return null;
        }

        return (
          <ComparisonLeadCard
            key={itemId}
            membership={membership}
            redditItem={redditItem}
            resultByRunAndItem={resultByRunAndItem}
            runIndexById={runIndexById}
            runs={runs}
          />
        );
      })}
    </div>
  );
}

function ComparisonLeadCard({
  membership,
  redditItem,
  resultByRunAndItem,
  runIndexById,
  runs,
}: {
  membership: PlaygroundComparisonMembership;
  redditItem: ComparisonRedditItem;
  resultByRunAndItem: Map<string, Map<string, ComparisonResult>>;
  runIndexById: Map<string, number>;
  runs: ComparisonRun[];
}) {
  const qualifiedResults = runs
    .filter((run) => membership.qualifiedRunIds.includes(run.id))
    .map((run) => resultByRunAndItem.get(run.id)?.get(redditItem.id))
    .filter((result): result is ComparisonResult => Boolean(result));
  const summary = qualifiedResults.find((result) => result.summary)?.summary ?? null;
  const source = getSourcePreview(redditItem.body, redditItem.description);

  return (
    <article className="rounded-[18px] border border-white/[0.06] bg-[#181818] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-[0.12em]">
            <span className="rounded-full bg-[#1ed760]/10 px-2.5 py-1 text-[#73f5a0]">Qualified in {membership.qualifiedRunIds.length}</span>
            <span className="rounded-full bg-[#242424] px-2.5 py-1 text-[#a1a1aa]">Matched in {membership.semanticRunIds.length}</span>
            {membership.strongRunIds.length > 0 ? <span className="rounded-full bg-[#3b2d10] px-2.5 py-1 text-[#ffd66e]">Strong in {membership.strongRunIds.length}</span> : null}
          </div>
          <h3 className="mt-3 text-[15px] font-bold leading-6 text-[#ffffff] [overflow-wrap:anywhere]">{redditItem.title || source || "Untitled Reddit post"}</h3>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737373]">r/{redditItem.subreddit} / Fetched {formatDate(redditItem.fetchedAt)}</p>
        </div>
        {redditItem.url ? (
          <Link className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-[#111111] px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[#ffffff] hover:bg-[#252525]" href={redditItem.url} rel="noreferrer" target="_blank">
            Reddit
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      {summary ? <p className="mt-3 text-[13px] leading-5 text-[#b3b3b3]">{summary}</p> : null}
      {source ? (
        <details className="mt-3 rounded-[13px] border border-white/[0.05] bg-[#111111]">
          <summary className="cursor-pointer px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#a1a1aa]">View Reddit text</summary>
          <p className="border-t border-white/[0.05] px-3 py-3 text-[12px] leading-5 text-[#8f8f8f]">{source}</p>
        </details>
      ) : null}
      <div className="mt-4 grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
        {runs.map((run) => {
          const result = resultByRunAndItem.get(run.id)?.get(redditItem.id);
          const qualified = membership.qualifiedRunIds.includes(run.id);
          const strong = membership.strongRunIds.includes(run.id);

          return (
            <div className={`rounded-[13px] border p-3 ${qualified ? "border-[#1ed760]/25 bg-[#1ed760]/[0.045]" : result ? "border-white/[0.06] bg-[#111111]" : "border-white/[0.04] bg-black/10 opacity-60"}`} key={run.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#d4d4d8]">{getRunName(run, runIndexById)}</p>
                <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] ${strong ? "bg-[#3b2d10] text-[#ffd66e]" : qualified ? "bg-[#12331f] text-[#73f5a0]" : "bg-[#242424] text-[#8f8f8f]"}`}>
                  {strong ? "Strong" : qualified ? "Qualified" : result ? "Below 50" : "No match"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Value label="Semantic" value={result ? result.bestScore.toFixed(3) : "-"} />
                <Value label="LLM" value={result?.score ?? "-"} />
              </div>
              {result?.bestQueryText ? <p className="mt-3 line-clamp-3 text-[10px] leading-4 text-[#737373]">{result.bestQueryText}</p> : null}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function SmallMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[11px] border border-white/[0.05] bg-black/20 px-3 py-2">
      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</p>
      <p className="mt-1 text-[15px] font-bold text-[#f4f4f5]">{value}</p>
    </div>
  );
}

function Value({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#737373]">{label}</p>
      <p className="mt-1 text-[13px] font-bold text-[#f4f4f5]">{value}</p>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-b-0 last:pb-0">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</dt>
      <dd className="text-right text-[11px] font-medium leading-4 text-[#d4d4d8]">{value}</dd>
    </div>
  );
}

function getConfigurationWarnings(runs: ComparisonRun[]) {
  const warnings: string[] = [];
  const scopes = new Set(runs.map((run) => getPlaygroundCandidateScopeFromSnapshot(run.querySnapshot)));
  const thresholds = new Set(runs.map((run) => run.threshold.toFixed(6)));
  const windows = new Set(runs.map((run) => `${run.fetchedFrom.toISOString()}:${run.fetchedTo.toISOString()}`));

  if (scopes.size > 1) warnings.push("Candidate scopes differ, so some runs searched different subreddit pools.");
  if (thresholds.size > 1) warnings.push("Minimum semantic thresholds differ, which changes how many posts enter LLM classification.");
  if (windows.size > 1) warnings.push("Fetched-time windows differ, so output volume is not a perfectly controlled comparison.");

  return warnings;
}

function getRunName(run: ComparisonRun | undefined, runIndexById: Map<string, number>) {
  if (!run) return "Unknown run";
  const index = runIndexById.get(run.id) ?? 0;
  return `Run ${String.fromCharCode(65 + index)}`;
}

function getRunTitle(title: string | null) {
  return title?.trim() || "Untitled playground run";
}

function parseRunIds(value: string | undefined) {
  if (!value?.trim()) return [];
  return Array.from(new Set(value.split(",").map((runId) => runId.trim()).filter(Boolean)));
}

function emptyMetrics(runId: string): PlaygroundComparisonRunMetrics {
  return {
    averageQualifiedScore: 0,
    classified: 0,
    qualificationRate: 0,
    qualifiedLeads: 0,
    runId,
    semanticMatches: 0,
    strongLeads: 0,
    uniqueQualifiedLeads: 0,
  };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatDateRange(from: Date, to: Date) {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

function getSourcePreview(body: string | null, description: string | null) {
  const content = (body?.trim() || description?.trim() || "").replace(/\s+/g, " ").trim();
  return content.length <= 500 ? content : `${content.slice(0, 497)}...`;
}
