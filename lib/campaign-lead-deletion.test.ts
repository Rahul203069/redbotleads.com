import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDailySemanticRunStatsAfterLeadDeletion,
  getCampaignLeadDeletionRevalidationPaths,
} from "./campaign-lead-deletion";

test("recalculates daily semantic counts while preserving unrelated run stats", () => {
  assert.deepEqual(
    buildDailySemanticRunStatsAfterLeadDeletion({
      existingStats: {
        durationMs: 1234,
        globalSubredditCount: 20,
        matchedPosts: 99,
      },
      leads: [
        { ai: { id: "ai-1" }, score: 90 },
        { ai: { id: "ai-2" }, score: 60 },
        { ai: null, score: 0 },
      ],
      matchedScans: 3,
      noMatchScans: 7,
    }),
    {
      durationMs: 1234,
      globalSubredditCount: 20,
      matchedPosts: 3,
      noMatchPosts: 7,
      scannedPosts: 10,
      totalLeadsFound: 3,
      classifiedLeads: 2,
      strongLeads: 1,
      notStrongLeads: 1,
      pendingClassifications: 1,
    },
  );
});

test("revalidates authenticated, analytics, and both public campaign views", () => {
  const paths = getCampaignLeadDeletionRevalidationPaths("campaign-1");

  assert.ok(paths.includes("/campaigns/campaign-1"));
  assert.ok(paths.includes("/campaigns/campaign-1/daily-leads"));
  assert.ok(paths.includes("/share/campaigns/campaign-1"));
  assert.ok(paths.includes("/share/leads/campaign-1"));
});
