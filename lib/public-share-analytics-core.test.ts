import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicShareViewStats,
  getPublicShareViewCounters,
  hashPublicShareVisitorToken,
  isPublicShareVisitorToken,
  shouldTrackPublicShareView,
} from "./public-share-analytics-core";

test("maps each public page kind to its own view counter", () => {
  assert.deepEqual(getPublicShareViewCounters("campaign"), {
    campaignViews: 1,
    leadsViews: 0,
  });
  assert.deepEqual(getPublicShareViewCounters("leads"), {
    campaignViews: 0,
    leadsViews: 1,
  });
});

test("combines views while preserving deduplicated unique visitor totals", () => {
  assert.deepEqual(
    buildPublicShareViewStats({
      campaignUniqueVisitors: 3,
      campaignViews: 7,
      leadsUniqueVisitors: 4,
      leadsViews: 9,
      overallUniqueVisitors: 5,
    }),
    {
      overall: {
        views: 16,
        uniqueVisitors: 5,
      },
      campaign: {
        views: 7,
        uniqueVisitors: 3,
      },
      leads: {
        views: 9,
        uniqueVisitors: 4,
      },
    },
  );
});

test("accepts UUID v4 visitor cookies and rejects malformed values", () => {
  assert.equal(isPublicShareVisitorToken("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isPublicShareVisitorToken("550e8400-e29b-11d4-a716-446655440000"), false);
  assert.equal(isPublicShareVisitorToken("not-a-token"), false);
  assert.equal(isPublicShareVisitorToken(undefined), false);
});

test("hashes visitor cookies without retaining the raw token", () => {
  const token = "550e8400-e29b-41d4-a716-446655440000";
  const hash = hashPublicShareVisitorToken(token);

  assert.equal(hash.length, 64);
  assert.notEqual(hash, token);
  assert.equal(hash, hashPublicShareVisitorToken(token));
});

test("excludes the signed-in campaign owner but counts anonymous and client visitors", () => {
  assert.equal(shouldTrackPublicShareView({ campaignOwnerId: "owner-1", sessionUserId: "owner-1" }), false);
  assert.equal(shouldTrackPublicShareView({ campaignOwnerId: "owner-1", sessionUserId: "client-1" }), true);
  assert.equal(shouldTrackPublicShareView({ campaignOwnerId: "owner-1", sessionUserId: undefined }), true);
});
