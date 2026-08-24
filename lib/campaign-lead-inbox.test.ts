import assert from "node:assert/strict";
import test from "node:test";

import {
  countCampaignLeadStatuses,
  formatLeadRelativeTime,
  getCampaignLeadDateKey,
  getCampaignLeadGroupLabel,
  getJustAddedCampaignLeadIds,
  isCampaignLeadNewSinceVisit,
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

test("formats live feed ages in compact relative units", () => {
  const now = new Date("2026-08-24T12:00:00.000Z").getTime();

  assert.equal(formatLeadRelativeTime("2026-08-24T11:59:40.000Z", now), "just now");
  assert.equal(formatLeadRelativeTime("2026-08-24T11:42:00.000Z", now), "18m ago");
  assert.equal(formatLeadRelativeTime("2026-08-24T09:00:00.000Z", now), "3h ago");
  assert.equal(formatLeadRelativeTime("2026-08-22T12:00:00.000Z", now), "2d ago");
});
