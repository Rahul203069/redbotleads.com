import assert from "node:assert/strict";
import test from "node:test";

import { analyzePlaygroundRunComparison } from "./playground-run-comparison";

function result(
  redditItemId: string,
  score: number | null,
  label: string | null = score !== null && score >= 80 ? "HIGH" : "MED",
  classificationStatus = "CLASSIFIED",
) {
  return {
    bestScore: 0.7,
    classificationStatus,
    label,
    redditItemId,
    score,
  };
}

test("finds common and unique qualified leads while retaining semantic membership", () => {
  const analysis = analyzePlaygroundRunComparison([
    { id: "a", results: [result("shared", 90), result("only-a", 70), result("below-in-a", 40)] },
    { id: "b", results: [result("shared", 85), result("only-b", 65), result("only-a", 30)] },
  ]);

  assert.deepEqual(analysis.commonToAllQualifiedIds, ["shared"]);
  assert.deepEqual(analysis.uniqueQualifiedIdsByRunId, {
    a: ["only-a"],
    b: ["only-b"],
  });
  assert.deepEqual(
    analysis.memberships.find((membership) => membership.redditItemId === "only-a"),
    {
      qualifiedRunIds: ["a"],
      redditItemId: "only-a",
      semanticRunIds: ["a", "b"],
      strongRunIds: [],
    },
  );
});

test("groups partial overlaps by exact membership across three and four runs", () => {
  const analysis = analyzePlaygroundRunComparison([
    { id: "a", results: [result("all", 90), result("ab", 70), result("ac", 70)] },
    { id: "b", results: [result("all", 90), result("ab", 70), result("bd", 70)] },
    { id: "c", results: [result("all", 90), result("ac", 70)] },
    { id: "d", results: [result("all", 90), result("bd", 70), result("only-d", 70)] },
  ]);

  assert.deepEqual(analysis.commonToAllQualifiedIds, ["all"]);
  assert.deepEqual(analysis.partialQualifiedGroups, [
    { redditItemIds: ["ab"], runIds: ["a", "b"] },
    { redditItemIds: ["ac"], runIds: ["a", "c"] },
    { redditItemIds: ["bd"], runIds: ["b", "d"] },
  ]);
  assert.deepEqual(analysis.uniqueQualifiedIdsByRunId.d, ["only-d"]);
});

test("calculates pairwise percentages and zero denominators", () => {
  const analysis = analyzePlaygroundRunComparison([
    { id: "a", results: [result("one", 70), result("two", 70)] },
    { id: "b", results: [result("two", 70), result("three", 70)] },
    { id: "empty", results: [] },
  ]);

  assert.deepEqual(analysis.pairwiseQualified[0], {
    jaccardPercent: 33.33,
    leftCount: 2,
    leftPercent: 50,
    leftRunId: "a",
    rightCount: 2,
    rightPercent: 50,
    rightRunId: "b",
    sharedCount: 1,
    unionCount: 3,
  });
  assert.equal(analysis.pairwiseQualified.find((pair) => pair.rightRunId === "empty")?.rightPercent, 0);
});

test("ranks runs by strong leads, then qualified count, then average qualified score", () => {
  const analysis = analyzePlaygroundRunComparison([
    { id: "more-qualified", results: [result("a1", 74, "MED"), result("a2", 74, "MED")] },
    { id: "strong", results: [result("b1", 75, "MED")] },
    { id: "also-strong", results: [result("c1", 90, "HIGH")] },
  ]);

  assert.deepEqual(analysis.winnerRunIds, ["also-strong"]);
});

test("counts scores of 75 or higher as strong regardless of the stored AI label", () => {
  const analysis = analyzePlaygroundRunComparison([
    { id: "boundary", results: [result("below-75", 74, "HIGH"), result("at-75", 75, "MED")] },
  ]);

  assert.equal(analysis.runMetrics[0]?.strongLeads, 1);
  assert.deepEqual(analysis.memberships.find((item) => item.redditItemId === "below-75")?.strongRunIds, []);
  assert.deepEqual(analysis.memberships.find((item) => item.redditItemId === "at-75")?.strongRunIds, ["boundary"]);
});

test("returns every run when the strong-first metrics are tied", () => {
  const analysis = analyzePlaygroundRunComparison([
    { id: "a", results: [result("one", 80, "HIGH")] },
    { id: "b", results: [result("two", 80, "HIGH")] },
  ]);

  assert.deepEqual(analysis.winnerRunIds, ["a", "b"]);
});
