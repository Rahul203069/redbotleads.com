import assert from "node:assert/strict";
import test from "node:test";

import {
  countCampaignLeadStatuses,
  getCampaignLeadDateKey,
  getCampaignLeadGroupLabel,
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
