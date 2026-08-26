import assert from "node:assert/strict";
import test from "node:test";

import {
  getNextSemanticScanAt,
  getSemanticScanScheduleBucket,
} from "./daily-semantic-schedule";
import { formatDateTimeInTimeZone } from "./time-zone";

test("returns the next half-hour boundary", () => {
  assert.equal(
    getNextSemanticScanAt(new Date("2026-08-06T06:29:59.999Z")).toISOString(),
    "2026-08-06T06:30:00.000Z",
  );
});

test("moves to the following half-hour when called exactly on a boundary", () => {
  assert.equal(
    getNextSemanticScanAt(new Date("2026-08-06T06:30:00.000Z")).toISOString(),
    "2026-08-06T07:00:00.000Z",
  );
});

test("builds separate stable UTC buckets for each half-hour", () => {
  assert.equal(
    getSemanticScanScheduleBucket(new Date("2026-08-06T07:29:59.999Z")),
    "2026-08-06T07:00",
  );
  assert.equal(
    getSemanticScanScheduleBucket(new Date("2026-08-06T07:30:00.000Z")),
    "2026-08-06T07:30",
  );
});

test("displays a half-hour boundary in the viewer timezone", () => {
  assert.match(
    formatDateTimeInTimeZone("2026-08-06T07:30:00.000Z", "Europe/Amsterdam"),
    /9:30 AM/,
  );
});
