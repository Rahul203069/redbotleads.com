import assert from "node:assert/strict";
import test from "node:test";

import {
  getRedditPostRecencyCutoff,
  isRedditPostOutsideRecencyWindow,
  REDDIT_POST_MAX_AGE_MS,
} from "./reddit-post-recency";

const referenceTime = new Date("2026-07-19T12:00:00.000Z");

test("builds a rolling 72-hour Reddit post cutoff", () => {
  assert.equal(
    getRedditPostRecencyCutoff(referenceTime).toISOString(),
    "2026-07-16T12:00:00.000Z",
  );
  assert.equal(REDDIT_POST_MAX_AGE_MS, 72 * 60 * 60 * 1000);
});

test("keeps posts at or inside the 72-hour boundary", () => {
  assert.equal(
    isRedditPostOutsideRecencyWindow(new Date("2026-07-16T12:00:00.000Z"), referenceTime),
    false,
  );
  assert.equal(
    isRedditPostOutsideRecencyWindow(new Date("2026-07-16T12:00:00.001Z"), referenceTime),
    false,
  );
});

test("rejects posts older than the 72-hour boundary", () => {
  assert.equal(
    isRedditPostOutsideRecencyWindow(new Date("2026-07-16T11:59:59.999Z"), referenceTime),
    true,
  );
});
