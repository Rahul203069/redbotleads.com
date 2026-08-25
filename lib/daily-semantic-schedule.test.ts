import assert from "node:assert/strict";
import test from "node:test";

import {
  getHourlySemanticScheduleBucket,
  getNextHourlySemanticCronAt,
} from "./daily-semantic-schedule";
import { formatDateTimeInTimeZone } from "./time-zone";

test("returns the next UTC hour before a boundary", () => {
  assert.equal(
    getNextHourlySemanticCronAt(new Date("2026-08-06T06:29:59.999Z")).toISOString(),
    "2026-08-06T07:00:00.000Z",
  );
});

test("moves to the following hour when called exactly on a boundary", () => {
  assert.equal(
    getNextHourlySemanticCronAt(new Date("2026-08-06T07:00:00.000Z")).toISOString(),
    "2026-08-06T08:00:00.000Z",
  );
});

test("builds one stable UTC bucket for every hour", () => {
  assert.equal(
    getHourlySemanticScheduleBucket(new Date("2026-08-06T07:59:59.999Z")),
    "2026-08-06T07",
  );
  assert.equal(
    getHourlySemanticScheduleBucket(new Date("2026-08-06T08:00:00.000Z")),
    "2026-08-06T08",
  );
});

test("displays an hourly boundary in the viewer timezone", () => {
  assert.match(
    formatDateTimeInTimeZone("2026-08-06T07:00:00.000Z", "Europe/Amsterdam"),
    /9:00 AM/,
  );
});
