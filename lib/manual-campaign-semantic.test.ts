import assert from "node:assert/strict";
import test from "node:test";

import {
  getSemanticLookbackHours,
  getSemanticPostRecencyWindow,
  resolveManualCampaignSemanticState,
} from "./manual-campaign-semantic";

test("uses 24 hours until a semantic run completes, then the recurring window", () => {
  assert.equal(getSemanticLookbackHours({ hasCompletedSemanticRun: false, recurringLookbackHours: 36 }), 24);
  assert.equal(getSemanticLookbackHours({ hasCompletedSemanticRun: true, recurringLookbackHours: 36 }), 36);
});

test("uses a rolling 24-hour post-age limit for first runs and the recurring limit after completion", () => {
  const referenceTime = new Date("2026-07-19T12:00:00.000Z");
  const initialWindow = getSemanticPostRecencyWindow({
    hasCompletedSemanticRun: false,
    recurringMaxPostAgeHours: 72,
    referenceTime,
  });
  const recurringWindow = getSemanticPostRecencyWindow({
    hasCompletedSemanticRun: true,
    recurringMaxPostAgeHours: 72,
    referenceTime,
  });

  assert.equal(initialWindow.maxPostAgeHours, 24);
  assert.equal(initialWindow.cutoff.toISOString(), "2026-07-18T12:00:00.000Z");
  assert.equal(new Date("2026-07-18T12:00:00.000Z").getTime() >= initialWindow.cutoff.getTime(), true);
  assert.equal(new Date("2026-07-18T11:59:59.999Z").getTime() >= initialWindow.cutoff.getTime(), false);
  assert.equal(recurringWindow.maxPostAgeHours, 72);
  assert.equal(recurringWindow.cutoff.toISOString(), "2026-07-16T12:00:00.000Z");
});

test("allows an active campaign with queries to run before its first success", () => {
  const state = resolveManualCampaignSemanticState({
    hasSemanticQueries: true,
    isActive: true,
  });

  assert.equal(state.status, "READY");
  assert.equal(state.canRun, true);
  assert.equal(state.message, "Search the last 24 hours of already-polled Reddit posts now.");
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
