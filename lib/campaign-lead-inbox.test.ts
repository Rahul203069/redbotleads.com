import assert from "node:assert/strict";
import test from "node:test";

import {
  countCampaignLeadStatuses,
  formatLeadRelativeTime,
  getCampaignLeadRefreshInterval,
  getCampaignLeadDateKey,
  getCampaignLeadGroupLabel,
  getJustAddedCampaignLeadIds,
  groupCampaignLeadsByDetectionMinute,
  groupCampaignLeadsByFreshness,
  isCampaignLeadNewSinceVisit,
  summarizeHistoricalCampaignLeads,
} from "./campaign-lead-inbox";

test("counts every shared workflow status and the complete inbox", () => {
  const counts = countCampaignLeadStatuses([
    { status: "NEW" },
    { status: "NEW" },
    { status: "REVIEWED" },
    { status: "SAVED" },
    { status: "CONTACTED" },
    { status: "DISMISSED" },
  ]);

  assert.deepEqual(counts, {
    ALL: 6,
    NEW: 2,
    REVIEWED: 1,
    SAVED: 1,
    CONTACTED: 1,
    DISMISSED: 1,
  });
});

test("summarizes only total leads and strong historical matches", () => {
  const summary = summarizeHistoricalCampaignLeads([
    { label: "HIGH" },
    { label: "MED" },
    { label: "HIGH" },
  ]);

  assert.deepEqual(summary, {
    leadCount: 3,
    strongMatchCount: 2,
  });
});

test("uses an honest empty historical summary when no leads were found", () => {
  assert.deepEqual(summarizeHistoricalCampaignLeads([]), {
    leadCount: 0,
    strongMatchCount: 0,
  });
});

test("never polls a historical selection even while the current campaign sync is running", () => {
  assert.equal(getCampaignLeadRefreshInterval({
    isLiveToday: false,
    isSyncRunning: true,
    selectedPeriodIsToday: false,
  }), null);
});

test("preserves refresh timing for current-day campaign views", () => {
  assert.equal(getCampaignLeadRefreshInterval({
    isLiveToday: true,
    isSyncRunning: false,
    selectedPeriodIsToday: true,
  }), 30_000);
  assert.equal(getCampaignLeadRefreshInterval({
    isLiveToday: false,
    isSyncRunning: true,
    selectedPeriodIsToday: true,
  }), 10_000);
});

test("groups detected leads using the viewer timezone", () => {
  assert.equal(
    getCampaignLeadDateKey("2026-08-21T20:15:00.000Z", "Asia/Calcutta"),
    "2026-08-22",
  );
  assert.equal(
    getCampaignLeadDateKey("2026-08-21T20:15:00.000Z", "America/Toronto"),
    "2026-08-21",
  );
});

test("labels current and previous local dates clearly", () => {
  assert.equal(getCampaignLeadGroupLabel({
    dateKey: "2026-08-22",
    timeZone: "Asia/Calcutta",
    todayDateKey: "2026-08-22",
  }), "Today");
  assert.equal(getCampaignLeadGroupLabel({
    dateKey: "2026-08-21",
    timeZone: "Asia/Calcutta",
    todayDateKey: "2026-08-22",
  }), "Yesterday");
  assert.equal(getCampaignLeadGroupLabel({
    dateKey: "2026-08-18",
    timeZone: "Asia/Calcutta",
    todayDateKey: "2026-08-22",
  }), "August 18");
});

test("marks only real leads detected after the previous visit as new", () => {
  assert.equal(isCampaignLeadNewSinceVisit({
    createdAt: "2026-08-24T10:01:00.000Z",
    previousVisitAt: "2026-08-24T10:00:00.000Z",
  }), true);
  assert.equal(isCampaignLeadNewSinceVisit({
    createdAt: "2026-08-24T10:00:00.000Z",
    previousVisitAt: "2026-08-24T10:00:00.000Z",
  }), false);
  assert.equal(isCampaignLeadNewSinceVisit({
    createdAt: "2026-08-24T10:01:00.000Z",
    isDemo: true,
    previousVisitAt: null,
  }), false);
});

test("treats real leads as new to a first-time visitor", () => {
  assert.equal(isCampaignLeadNewSinceVisit({
    createdAt: "2026-08-24T10:01:00.000Z",
    previousVisitAt: null,
  }), true);
});

test("finds real lead IDs that were not present in the current live session", () => {
  assert.deepEqual(getJustAddedCampaignLeadIds(
    new Set(["known"]),
    [{ id: "known" }, { id: "new" }, { id: "demo", isDemo: true }],
  ), ["new"]);
});

test("separates returning-visitor leads into new and earlier sections", () => {
  const leads = [
    { id: "newest", createdAt: "2026-08-24T10:03:00.000Z" },
    { id: "older", createdAt: "2026-08-24T09:59:00.000Z" },
    { id: "newer", createdAt: "2026-08-24T10:01:00.000Z" },
  ];

  const groups = groupCampaignLeadsByFreshness(
    leads,
    "2026-08-24T10:00:00.000Z",
  );

  assert.deepEqual(groups.newLeads.map((lead) => lead.id), ["newest", "newer"]);
  assert.deepEqual(groups.earlierLeads.map((lead) => lead.id), ["older"]);
  assert.deepEqual(groups.demoLeads, []);
});

test("treats every real lead as new on a first visit and keeps demos separate", () => {
  const groups = groupCampaignLeadsByFreshness([
    { id: "real-one", createdAt: "2026-08-24T10:03:00.000Z" },
    { id: "demo", createdAt: "2026-08-24T10:02:00.000Z", isDemo: true },
    { id: "real-two", createdAt: "2026-08-24T10:01:00.000Z" },
  ], null);

  assert.deepEqual(groups.newLeads.map((lead) => lead.id), ["real-one", "real-two"]);
  assert.deepEqual(groups.earlierLeads, []);
  assert.deepEqual(groups.demoLeads.map((lead) => lead.id), ["demo"]);
});

test("can present demo leads in the same freshness sections as fetched leads", () => {
  const groups = groupCampaignLeadsByFreshness([
    { id: "demo", createdAt: "2026-08-24T10:02:00.000Z", isDemo: true },
  ], "2026-08-24T10:00:00.000Z", { treatDemoAsReal: true });

  assert.deepEqual(groups.newLeads.map((lead) => lead.id), ["demo"]);
  assert.deepEqual(groups.earlierLeads, []);
  assert.deepEqual(groups.demoLeads, []);
});

test("groups newly detected leads into newest-first minute batches", () => {
  const batches = groupCampaignLeadsByDetectionMinute([
    { id: "middle", createdAt: "2026-08-24T10:14:12.000Z" },
    { id: "newest", createdAt: "2026-08-24T10:15:01.000Z" },
    { id: "oldest", createdAt: "2026-08-24T10:14:02.000Z" },
  ]);

  assert.deepEqual(batches.map((batch) => ({
    detectedAt: batch.detectedAt,
    id: batch.id,
    leadIds: batch.leads.map((lead) => lead.id),
  })), [
    {
      detectedAt: "2026-08-24T10:15:01.000Z",
      id: "2026-08-24T10:15:00.000Z",
      leadIds: ["newest"],
    },
    {
      detectedAt: "2026-08-24T10:14:12.000Z",
      id: "2026-08-24T10:14:00.000Z",
      leadIds: ["middle", "oldest"],
    },
  ]);
});

test("keeps invalid detection timestamps in a safe fallback batch", () => {
  const batches = groupCampaignLeadsByDetectionMinute([
    { id: "invalid-one", createdAt: "not-a-date" },
    { id: "valid", createdAt: "2026-08-24T10:14:12.000Z" },
    { id: "invalid-two", createdAt: "" },
  ]);

  assert.deepEqual(batches.map((batch) => ({
    detectedAt: batch.detectedAt,
    id: batch.id,
    leadIds: batch.leads.map((lead) => lead.id),
  })), [
    {
      detectedAt: "2026-08-24T10:14:12.000Z",
      id: "2026-08-24T10:14:00.000Z",
      leadIds: ["valid"],
    },
    {
      detectedAt: null,
      id: "unknown",
      leadIds: ["invalid-one", "invalid-two"],
    },
  ]);
});

test("formats live feed ages in compact relative units", () => {
  const now = new Date("2026-08-24T12:00:00.000Z").getTime();

  assert.equal(formatLeadRelativeTime("2026-08-24T11:59:40.000Z", now), "just now");
  assert.equal(formatLeadRelativeTime("2026-08-24T11:42:00.000Z", now), "18m ago");
  assert.equal(formatLeadRelativeTime("2026-08-24T09:00:00.000Z", now), "3h ago");
  assert.equal(formatLeadRelativeTime("2026-08-22T12:00:00.000Z", now), "2d ago");
});
