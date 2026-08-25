import assert from "node:assert/strict";
import test from "node:test";

import { buildScheduledSemanticJobId } from "./semantic-job-id";

test("uses one deterministic job ID within an hourly bucket", () => {
  assert.equal(
    buildScheduledSemanticJobId("campaign-1", "2026-08-25T14"),
    buildScheduledSemanticJobId("campaign-1", "2026-08-25T14"),
  );
});

test("creates a fresh job ID for the following hour", () => {
  assert.notEqual(
    buildScheduledSemanticJobId("campaign-1", "2026-08-25T14"),
    buildScheduledSemanticJobId("campaign-1", "2026-08-25T15"),
  );
});

test("removes BullMQ-incompatible colons from the bucket", () => {
  assert.equal(
    buildScheduledSemanticJobId("campaign-1", "2026-08-25T14"),
    "daily-semantic--campaign-1--2026-08-25T14",
  );
});
