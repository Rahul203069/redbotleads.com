import assert from "node:assert/strict";
import test from "node:test";

import { resolveCampaignLeadEmptyState } from "./campaign-lead-empty-state";

test("shows no results for a historical selection regardless of today's processing status", () => {
  assert.equal(
    resolveCampaignLeadEmptyState({ mode: "NO_RESULTS", syncStatus: "PROCESSING" }),
    "NO_RESULTS",
  );
  assert.equal(
    resolveCampaignLeadEmptyState({ mode: "NO_RESULTS", syncStatus: "QUEUED" }),
    "NO_RESULTS",
  );
});

test("waits when the selected current day has not completed its semantic run", () => {
  assert.equal(
    resolveCampaignLeadEmptyState({ mode: "WAITING", syncStatus: "IDLE" }),
    "WAITING",
  );
});

test("shows no results after a completed run finds zero qualified leads", () => {
  assert.equal(
    resolveCampaignLeadEmptyState({ mode: "AUTO", syncStatus: "COMPLETED" }),
    "NO_RESULTS",
  );
});

test("preserves automatic processing and failure states for legacy callers", () => {
  assert.equal(
    resolveCampaignLeadEmptyState({ mode: "AUTO", syncStatus: "PROCESSING" }),
    "WAITING",
  );
  assert.equal(
    resolveCampaignLeadEmptyState({ mode: "AUTO", syncStatus: "FAILED" }),
    "FAILED",
  );
});

test("keeps the legacy idle state waiting when no explicit date context is supplied", () => {
  assert.equal(
    resolveCampaignLeadEmptyState({ mode: "AUTO", syncStatus: "IDLE" }),
    "WAITING",
  );
});
