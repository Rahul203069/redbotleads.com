import assert from "node:assert/strict";
import test from "node:test";

import {
  getClientActivityEligibility,
  getClientActivityRange,
  getClientEngagementStatus,
  isClientActivityEventShapeValid,
  shouldCoalesceClientPageView,
  summarizeClientActivity,
} from "./client-activity-core";

test("excludes admins and unassigned users from client activity tracking", () => {
  assert.equal(getClientActivityEligibility({ hasAssignment: true, isAdmin: true }), "ADMIN_EXCLUDED");
  assert.equal(getClientActivityEligibility({ hasAssignment: false, isAdmin: false }), "NOT_ASSIGNED");
  assert.equal(getClientActivityEligibility({ hasAssignment: true, isAdmin: false }), null);
});

test("requires a lead for review actions and rejects leads on page views", () => {
  assert.equal(isClientActivityEventShapeValid({
    eventType: "LEAD_EXPANDED",
    leadId: "lead-1",
  }), true);
  assert.equal(isClientActivityEventShapeValid({
    eventType: "REDDIT_LINK_CLICKED",
  }), false);
  assert.equal(isClientActivityEventShapeValid({
    eventType: "CAMPAIGN_DASHBOARD_VIEW",
    leadId: "lead-1",
  }), false);
  assert.equal(isClientActivityEventShapeValid({
    eventType: "DAILY_LEADS_VIEW",
  }), true);
});

test("coalesces rapid page views but never coalesces lead actions", () => {
  const now = new Date("2026-07-23T12:00:00.000Z");

  assert.equal(shouldCoalesceClientPageView({
    eventType: "CAMPAIGN_DASHBOARD_VIEW",
    lastRecordedAt: new Date("2026-07-23T11:56:00.000Z"),
    now,
  }), true);
  assert.equal(shouldCoalesceClientPageView({
    eventType: "DAILY_LEADS_VIEW",
    lastRecordedAt: new Date("2026-07-23T11:54:59.000Z"),
    now,
  }), false);
  assert.equal(shouldCoalesceClientPageView({
    eventType: "LEAD_EXPANDED",
    lastRecordedAt: new Date("2026-07-23T11:59:59.000Z"),
    now,
  }), false);
});

test("counts active days and distinct reviewed leads correctly", () => {
  const summary = summarizeClientActivity([
    {
      createdAt: new Date("2026-07-22T08:00:00.000Z"),
      eventType: "CAMPAIGN_DASHBOARD_VIEW",
      leadId: null,
    },
    {
      createdAt: new Date("2026-07-22T08:05:00.000Z"),
      eventType: "LEAD_EXPANDED",
      leadId: "lead-1",
    },
    {
      createdAt: new Date("2026-07-22T08:06:00.000Z"),
      eventType: "REDDIT_LINK_CLICKED",
      leadId: "lead-1",
    },
    {
      createdAt: new Date("2026-07-23T09:00:00.000Z"),
      eventType: "DAILY_LEADS_VIEW",
      leadId: null,
    },
    {
      createdAt: new Date("2026-07-23T09:03:00.000Z"),
      eventType: "LEAD_EXPANDED",
      leadId: "lead-2",
    },
  ]);

  assert.equal(summary.activeDays, 2);
  assert.equal(summary.dashboardVisits, 2);
  assert.equal(summary.leadExpansions, 2);
  assert.equal(summary.redditClicks, 1);
  assert.equal(summary.uniqueLeadsReviewed, 2);
});

test("page visits alone do not count as reviewed leads", () => {
  const summary = summarizeClientActivity([
    {
      createdAt: new Date("2026-07-23T09:00:00.000Z"),
      eventType: "CAMPAIGN_DASHBOARD_VIEW",
      leadId: null,
    },
    {
      createdAt: new Date("2026-07-23T09:10:00.000Z"),
      eventType: "DAILY_LEADS_VIEW",
      leadId: null,
    },
  ]);

  assert.equal(summary.dashboardVisits, 2);
  assert.equal(summary.uniqueLeadsReviewed, 0);
});

test("calculates engagement statuses at the documented boundaries", () => {
  const now = new Date("2026-07-23T12:00:00.000Z");

  assert.equal(getClientEngagementStatus(null, now), "NEVER_ACTIVE");
  assert.equal(getClientEngagementStatus(new Date("2026-07-16T12:00:00.000Z"), now), "ACTIVE");
  assert.equal(getClientEngagementStatus(new Date("2026-07-16T11:59:59.000Z"), now), "QUIET");
  assert.equal(getClientEngagementStatus(new Date("2026-06-23T12:00:00.000Z"), now), "QUIET");
  assert.equal(getClientEngagementStatus(new Date("2026-06-23T11:59:59.000Z"), now), "INACTIVE");
});

test("parses preset and valid custom activity ranges safely", () => {
  const now = new Date("2026-07-23T12:00:00.000Z");
  const preset = getClientActivityRange({ range: "7" }, now);
  const custom = getClientActivityRange({
    from: "2026-07-01",
    range: "custom",
    to: "2026-07-03",
  }, now);
  const invalid = getClientActivityRange({
    from: "bad",
    range: "custom",
    to: "2026-07-03",
  }, now);

  assert.equal(preset.key, "7");
  assert.equal(preset.from.toISOString(), "2026-07-16T12:00:00.000Z");
  assert.equal(custom.from.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(custom.to.toISOString(), "2026-07-04T00:00:00.000Z");
  assert.equal(invalid.key, "30");
});
