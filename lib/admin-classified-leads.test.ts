import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignLeadView } from "./campaign-leads";
import {
  buildAdminClassifiedLeadsJson,
  getAdminClassifiedLeads,
} from "./admin-classified-leads";

const classifiedLead: CampaignLeadView = {
  id: "lead-low-score",
  score: 12,
  semanticScore: 0.43,
  label: "LOW",
  status: "NEW",
  createdAt: "2026-07-20T10:00:00.000Z",
  ai: {
    intentType: "implicit",
    buyerStage: "problem_aware",
    category: "support",
    summary: "The author is looking for a better workflow.",
    painPoints: ["Manual work"],
    disqualifier: null,
  },
  redditItem: {
    type: "POST",
    subreddit: "saas",
    title: "How do you manage this?",
    description: "A short description",
    body: "The full source text",
    url: "https://reddit.com/r/saas/example",
  },
};

test("keeps every LLM-classified lead even when its score is below the visible threshold", () => {
  const pendingLead: CampaignLeadView = {
    ...classifiedLead,
    id: "lead-pending",
    score: 99,
    ai: null,
  };

  assert.deepEqual(getAdminClassifiedLeads([pendingLead, classifiedLead]), [classifiedLead]);
});

test("builds JSON with campaign and date-selection context", () => {
  const payload = buildAdminClassifiedLeadsJson({
    campaignId: "campaign-1",
    campaignName: "Example campaign",
    copiedAt: "2026-07-20T12:00:00.000Z",
    dateFilter: {
      from: "2026-07-20T00:00:00.000Z",
      to: "2026-07-21T00:00:00.000Z",
    },
    dateLabel: "Jul 20, 2026",
    leads: getAdminClassifiedLeads([classifiedLead]),
  });

  assert.equal(payload.totalClassifiedLeads, 1);
  assert.deepEqual(payload.campaign, {
    id: "campaign-1",
    name: "Example campaign",
  });
  assert.equal(payload.dateSelection.field, "lead.createdAt");
  assert.equal(payload.dateSelection.label, "Jul 20, 2026");
  assert.equal(payload.leads[0].score, 12);
  assert.equal(payload.leads[0].ai.summary, "The author is looking for a better workflow.");
  assert.equal(payload.leads[0].redditItem.body, "The full source text");
});
