import assert from "node:assert/strict";
import test from "node:test";

import {
  getSemanticLookbackHours,
  resolveManualCampaignSemanticState,
} from "./manual-campaign-semantic";

test("uses 25 hours until a semantic run completes, then the recurring window", () => {
  assert.equal(getSemanticLookbackHours({ hasCompletedSemanticRun: false, recurringLookbackHours: 36 }), 25);
  assert.equal(getSemanticLookbackHours({ hasCompletedSemanticRun: true, recurringLookbackHours: 36 }), 36);
});

test("allows an active campaign with queries to run before its first success", () => {
  const state = resolveManualCampaignSemanticState({
    hasSemanticQueries: true,
    isActive: true,
  });

  assert.equal(state.status, "READY");
  assert.equal(state.canRun, true);
});

test("keeps failed first runs retryable", () => {
  const state = resolveManualCampaignSemanticState({
    failedRun: { id: "failed", message: "Worker failed", status: "FAILED", statsJson: null },
    hasSemanticQueries: true,
    isActive: true,
  });

  assert.equal(state.status, "FAILED");
  assert.equal(state.canRun, true);
  assert.equal(state.runId, "failed");
});

test("a successful run permanently wins over newer failed or live runs", () => {
  const state = resolveManualCampaignSemanticState({
    completedRun: { id: "complete", message: null, status: "COMPLETED", statsJson: { matchedPosts: 4 } },
    failedRun: { id: "failed", message: null, status: "FAILED", statsJson: null },
    hasSemanticQueries: true,
    isActive: true,
    liveRun: { id: "live", message: null, status: "PROCESSING", statsJson: null },
  });

  assert.equal(state.status, "COMPLETED");
  assert.equal(state.canRun, false);
  assert.equal(state.runId, "complete");
  assert.equal(state.stats?.matchedPosts, 4);
});

test("inactive campaigns and campaigns without queries are unavailable", () => {
  assert.equal(resolveManualCampaignSemanticState({ hasSemanticQueries: true, isActive: false }).status, "UNAVAILABLE");
  assert.equal(resolveManualCampaignSemanticState({ hasSemanticQueries: false, isActive: true }).status, "UNAVAILABLE");
});
