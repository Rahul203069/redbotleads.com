import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminSemanticPassedPosts,
  buildAdminSemanticPassedScanWhere,
  buildCampaignLeadsJsonExport,
  type AdminSemanticPassedScanRecord,
} from "./admin-semantic-passed-posts";

const baseScan: AdminSemanticPassedScanRecord = {
  id: "scan-1",
  campaignRunId: "run-1",
  bestScore: 0.74,
  bestQueryId: "query-1",
  bestQueryText: "looking for a CRM",
  createdAt: new Date("2026-08-17T10:00:00.000Z"),
  redditItem: {
    id: "reddit-1",
    fullname: "t3_example",
    type: "POST",
    subreddit: "saas",
    title: "Looking for a CRM",
    description: "A short description",
    body: "Which CRM should I use?",
    author: "example-user",
    url: "https://reddit.com/example",
    createdUtc: new Date("2026-08-17T09:00:00.000Z"),
    fetchedAt: new Date("2026-08-17T09:05:00.000Z"),
    leads: [],
  },
};

test("builds a MATCHED POST scan scope for the selected date range", () => {
  const from = new Date("2026-08-17T00:00:00.000Z");
  const to = new Date("2026-08-18T00:00:00.000Z");
  const where = buildAdminSemanticPassedScanWhere({
    dateStarts: [],
    range: { from, to, source: "query" },
    ranges: [{ from, to }],
    source: "query",
  });

  assert.equal(where.status, "MATCHED");
  assert.equal(where.redditItem.type, "POST");
  assert.deepEqual("createdAt" in where ? where.createdAt : null, { gte: from, lt: to });
});

test("preserves every selected day when building a multi-date scan scope", () => {
  const first = {
    from: new Date("2026-08-15T00:00:00.000Z"),
    to: new Date("2026-08-16T00:00:00.000Z"),
  };
  const second = {
    from: new Date("2026-08-17T00:00:00.000Z"),
    to: new Date("2026-08-18T00:00:00.000Z"),
  };
  const where = buildAdminSemanticPassedScanWhere({
    dateStarts: [first.from.toISOString(), second.from.toISOString()],
    range: { from: first.from, to: second.to, source: "query" },
    ranges: [first, second],
    source: "dates",
  });

  assert.deepEqual("OR" in where ? where.OR : null, [
    { createdAt: { gte: first.from, lt: first.to } },
    { createdAt: { gte: second.from, lt: second.to } },
  ]);
});

test("keeps semantic scores while representing unclassified leads with null LLM fields", () => {
  const [postWithoutLead, postWithPendingLead] = buildAdminSemanticPassedPosts([
    baseScan,
    {
      ...baseScan,
      id: "scan-2",
      redditItem: {
        ...baseScan.redditItem,
        id: "reddit-2",
        leads: [{
          id: "lead-pending",
          score: 0,
          label: "MED",
          status: "NEW",
          createdAt: new Date("2026-08-17T10:01:00.000Z"),
          ai: null,
        }],
      },
    },
  ]);

  assert.equal(postWithoutLead.semanticScore, 0.74);
  assert.equal(postWithoutLead.lead, null);
  assert.equal(postWithPendingLead.lead?.llmScored, false);
  assert.equal(postWithPendingLead.lead?.score, null);
  assert.equal(postWithPendingLead.lead?.label, null);
  assert.equal(postWithPendingLead.lead?.ai, null);
});

test("includes completed LLM classification data and preserves the existing leads export", () => {
  const [semanticPost] = buildAdminSemanticPassedPosts([{
    ...baseScan,
    redditItem: {
      ...baseScan.redditItem,
      leads: [{
        id: "lead-scored",
        score: 82,
        label: "HIGH",
        status: "SAVED",
        createdAt: new Date("2026-08-17T10:01:00.000Z"),
        ai: {
          model: "gpt-5-mini",
          promptVersion: "lead-v3",
          intentType: "EXPLICIT",
          buyerStage: "EVALUATING",
          category: "software",
          summary: "The author is evaluating CRM options.",
          painPoints: ["Manual follow-up"],
          disqualifier: null,
        },
      }],
    },
  }]);
  const existingLead = { id: "existing-visible-lead", score: 82 };
  const payload = buildCampaignLeadsJsonExport({
    campaign: { id: "campaign-1", name: "CRM Leads" },
    copiedAt: "2026-08-17T12:00:00.000Z",
    dateFilter: {
      from: "2026-08-17T00:00:00.000Z",
      to: "2026-08-18T00:00:00.000Z",
    },
    dateLabel: "Aug 17, 2026",
    filters: { label: "ALL", minScore: 40 },
    leads: [existingLead],
    semanticPassedPosts: [semanticPost],
  });

  assert.deepEqual(payload.leads, [existingLead]);
  assert.equal(payload.totalLeads, 1);
  assert.equal(payload.totalSemanticPassedPosts, 1);
  assert.equal(payload.semanticPassedSelection.field, "semanticScan.createdAt");
  assert.equal(payload.semanticPassedPosts[0].lead?.llmScored, true);
  assert.equal(payload.semanticPassedPosts[0].lead?.score, 82);
  assert.equal(payload.semanticPassedPosts[0].lead?.label, "HIGH");
  assert.equal(payload.semanticPassedPosts[0].lead?.ai?.intentType, "explicit");
});
