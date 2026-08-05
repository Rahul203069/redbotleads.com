import assert from "node:assert/strict";
import test from "node:test";

import { getNextDailySemanticCronAt } from "./daily-semantic-schedule";
import { formatDateTimeInTimeZone } from "./time-zone";

test("targets 06:30 UTC on the current day before the boundary", () => {
  assert.equal(
    getNextDailySemanticCronAt(new Date("2026-08-06T06:29:59.999Z")).toISOString(),
    "2026-08-06T06:30:00.000Z",
  );
});

test("moves to the next UTC day once the boundary is reached", () => {
  assert.equal(
    getNextDailySemanticCronAt(new Date("2026-08-06T06:30:00.000Z")).toISOString(),
    "2026-08-07T06:30:00.000Z",
  );
});

test("displays the target as 08:30 in Amsterdam while CEST is active", () => {
  assert.match(
    formatDateTimeInTimeZone("2026-08-06T06:30:00.000Z", "Europe/Amsterdam"),
    /8:30 AM/,
  );
});

test("keeps the fixed UTC target in winter, when Amsterdam is on CET", () => {
  assert.match(
    formatDateTimeInTimeZone("2026-12-06T06:30:00.000Z", "Europe/Amsterdam"),
    /7:30 AM/,
  );
});
