export const PLAYGROUND_QUALIFIED_LEAD_MIN_SCORE = 50;

export type PlaygroundComparisonResultInput = {
  bestScore: number;
  classificationStatus: string;
  label: string | null;
  redditItemId: string;
  score: number | null;
};

export type PlaygroundComparisonRunInput = {
  id: string;
  results: PlaygroundComparisonResultInput[];
};

export type PlaygroundComparisonRunMetrics = {
  averageQualifiedScore: number;
  classified: number;
  qualificationRate: number;
  qualifiedLeads: number;
  runId: string;
  semanticMatches: number;
  strongLeads: number;
  uniqueQualifiedLeads: number;
};

export type PlaygroundComparisonPairwiseOverlap = {
  jaccardPercent: number;
  leftCount: number;
  leftPercent: number;
  leftRunId: string;
  rightCount: number;
  rightPercent: number;
  rightRunId: string;
  sharedCount: number;
  unionCount: number;
};

export type PlaygroundComparisonMembership = {
  qualifiedRunIds: string[];
  redditItemId: string;
  semanticRunIds: string[];
  strongRunIds: string[];
};

export type PlaygroundComparisonMembershipGroup = {
  redditItemIds: string[];
  runIds: string[];
};

export type PlaygroundComparisonAnalysis = {
  commonToAllQualifiedIds: string[];
  memberships: PlaygroundComparisonMembership[];
  pairwiseQualified: PlaygroundComparisonPairwiseOverlap[];
  pairwiseSemantic: PlaygroundComparisonPairwiseOverlap[];
  partialQualifiedGroups: PlaygroundComparisonMembershipGroup[];
  runMetrics: PlaygroundComparisonRunMetrics[];
  uniqueQualifiedIdsByRunId: Record<string, string[]>;
  winnerRunIds: string[];
};

export function analyzePlaygroundRunComparison(
  runs: PlaygroundComparisonRunInput[],
): PlaygroundComparisonAnalysis {
  const runIds = runs.map((run) => run.id);
  const semanticSets = new Map<string, Set<string>>();
  const qualifiedSets = new Map<string, Set<string>>();
  const strongSets = new Map<string, Set<string>>();
  const classifiedCounts = new Map<string, number>();
  const qualifiedScoreTotals = new Map<string, number>();
  const allRedditItemIds = new Set<string>();

  for (const run of runs) {
    const semantic = new Set<string>();
    const qualified = new Set<string>();
    const strong = new Set<string>();
    let classified = 0;
    let qualifiedScoreTotal = 0;

    for (const result of run.results) {
      semantic.add(result.redditItemId);
      allRedditItemIds.add(result.redditItemId);

      if (result.classificationStatus !== "CLASSIFIED" || result.score === null) {
        continue;
      }

      classified += 1;

      if (result.score < PLAYGROUND_QUALIFIED_LEAD_MIN_SCORE) {
        continue;
      }

      qualified.add(result.redditItemId);
      qualifiedScoreTotal += result.score;

      if (result.label === "HIGH") {
        strong.add(result.redditItemId);
      }
    }

    semanticSets.set(run.id, semantic);
    qualifiedSets.set(run.id, qualified);
    strongSets.set(run.id, strong);
    classifiedCounts.set(run.id, classified);
    qualifiedScoreTotals.set(run.id, qualifiedScoreTotal);
  }

  const memberships = [...allRedditItemIds]
    .sort()
    .map((redditItemId) => ({
      qualifiedRunIds: runIds.filter((runId) => qualifiedSets.get(runId)?.has(redditItemId)),
      redditItemId,
      semanticRunIds: runIds.filter((runId) => semanticSets.get(runId)?.has(redditItemId)),
      strongRunIds: runIds.filter((runId) => strongSets.get(runId)?.has(redditItemId)),
    }));
  const commonToAllQualifiedIds = memberships
    .filter((membership) => runIds.length > 0 && membership.qualifiedRunIds.length === runIds.length)
    .map((membership) => membership.redditItemId);
  const uniqueQualifiedIdsByRunId = Object.fromEntries(
    runIds.map((runId) => [
      runId,
      memberships
        .filter((membership) => membership.qualifiedRunIds.length === 1 && membership.qualifiedRunIds[0] === runId)
        .map((membership) => membership.redditItemId),
    ]),
  );
  const partialGroupMap = new Map<string, PlaygroundComparisonMembershipGroup>();

  for (const membership of memberships) {
    if (membership.qualifiedRunIds.length < 2 || membership.qualifiedRunIds.length === runIds.length) {
      continue;
    }

    const key = membership.qualifiedRunIds.join("|");
    const existing = partialGroupMap.get(key);

    if (existing) {
      existing.redditItemIds.push(membership.redditItemId);
    } else {
      partialGroupMap.set(key, {
        redditItemIds: [membership.redditItemId],
        runIds: membership.qualifiedRunIds,
      });
    }
  }

  const partialQualifiedGroups = [...partialGroupMap.values()].sort((left, right) =>
    right.redditItemIds.length - left.redditItemIds.length
    || right.runIds.length - left.runIds.length
    || left.runIds.join("|").localeCompare(right.runIds.join("|")),
  );
  const runMetrics = runs.map((run) => {
    const qualifiedCount = qualifiedSets.get(run.id)?.size ?? 0;
    const classified = classifiedCounts.get(run.id) ?? 0;

    return {
      averageQualifiedScore: qualifiedCount > 0
        ? roundToTwo((qualifiedScoreTotals.get(run.id) ?? 0) / qualifiedCount)
        : 0,
      classified,
      qualificationRate: classified > 0 ? roundToTwo((qualifiedCount / classified) * 100) : 0,
      qualifiedLeads: qualifiedCount,
      runId: run.id,
      semanticMatches: semanticSets.get(run.id)?.size ?? 0,
      strongLeads: strongSets.get(run.id)?.size ?? 0,
      uniqueQualifiedLeads: uniqueQualifiedIdsByRunId[run.id]?.length ?? 0,
    };
  });

  return {
    commonToAllQualifiedIds,
    memberships,
    pairwiseQualified: buildPairwiseOverlap(runIds, qualifiedSets),
    pairwiseSemantic: buildPairwiseOverlap(runIds, semanticSets),
    partialQualifiedGroups,
    runMetrics,
    uniqueQualifiedIdsByRunId,
    winnerRunIds: getWinnerRunIds(runMetrics),
  };
}

function buildPairwiseOverlap(
  runIds: string[],
  setsByRunId: Map<string, Set<string>>,
): PlaygroundComparisonPairwiseOverlap[] {
  const pairs: PlaygroundComparisonPairwiseOverlap[] = [];

  for (let leftIndex = 0; leftIndex < runIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < runIds.length; rightIndex += 1) {
      const leftRunId = runIds[leftIndex];
      const rightRunId = runIds[rightIndex];
      const left = setsByRunId.get(leftRunId) ?? new Set<string>();
      const right = setsByRunId.get(rightRunId) ?? new Set<string>();
      const sharedCount = countIntersection(left, right);
      const unionCount = new Set([...left, ...right]).size;

      pairs.push({
        jaccardPercent: unionCount > 0 ? roundToTwo((sharedCount / unionCount) * 100) : 0,
        leftCount: left.size,
        leftPercent: left.size > 0 ? roundToTwo((sharedCount / left.size) * 100) : 0,
        leftRunId,
        rightCount: right.size,
        rightPercent: right.size > 0 ? roundToTwo((sharedCount / right.size) * 100) : 0,
        rightRunId,
        sharedCount,
        unionCount,
      });
    }
  }

  return pairs;
}

function getWinnerRunIds(metrics: PlaygroundComparisonRunMetrics[]) {
  if (metrics.length === 0) {
    return [];
  }

  const sorted = [...metrics].sort(compareRunMetrics);
  const best = sorted[0];

  return sorted
    .filter((metric) => compareRunMetrics(metric, best) === 0)
    .map((metric) => metric.runId);
}

function compareRunMetrics(left: PlaygroundComparisonRunMetrics, right: PlaygroundComparisonRunMetrics) {
  return right.strongLeads - left.strongLeads
    || right.qualifiedLeads - left.qualifiedLeads
    || right.averageQualifiedScore - left.averageQualifiedScore;
}

function countIntersection(left: Set<string>, right: Set<string>) {
  let count = 0;

  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }

  return count;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}
