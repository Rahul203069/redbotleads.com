import assert from "node:assert/strict";
import test from "node:test";

import { buildScheduledSemanticJobId } from "./semantic-job-id";

test("uses one deterministic job ID within a half-hour bucket", () => {
  assert.equal(
    buildScheduledSemanticJobId("campaign-1", "2026-08-25T14:00"),
    buildScheduledSemanticJobId("campaign-1", "2026-08-25T14:00"),
  );
});

test("creates a fresh job ID for the following half-hour", () => {
  assert.notEqual(
    buildScheduledSemanticJobId("campaign-1", "2026-08-25T14:00"),
    buildScheduledSemanticJobId("campaign-1", "2026-08-25T14:30"),
  );
});

test("removes BullMQ-incompatible colons from the bucket", () => {
  assert.equal(
    buildScheduledSemanticJobId("campaign-1", "2026-08-25T14:30"),
    "daily-semantic--campaign-1--2026-08-25T14-30",
  );
});
