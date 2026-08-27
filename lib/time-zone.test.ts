import assert from "node:assert/strict";
import test from "node:test";

import {
  formatClockTimeInTimeZone,
  formatExactDateTimeInTimeZone,
  normalizeTimeZone,
} from "./time-zone";

test("formats detection times in the viewer timezone", () => {
  const detectedAt = "2026-08-24T10:15:01.000Z";

  assert.equal(formatClockTimeInTimeZone(detectedAt, "Asia/Kolkata"), "3:45 PM");
  assert.equal(formatClockTimeInTimeZone(detectedAt, "America/New_York"), "6:15 AM");
});

test("includes the viewer timezone in exact timestamp labels", () => {
  assert.match(
    formatExactDateTimeInTimeZone("2026-08-24T10:15:01.000Z", "Asia/Kolkata"),
    /Aug 24, 2026, 3:45:01 PM GMT\+5:30/,
  );
});

test("uses UTC as the safe fallback for invalid timezone values", () => {
  assert.equal(normalizeTimeZone("Not/A_Timezone"), "UTC");
  assert.equal(formatClockTimeInTimeZone("2026-08-24T10:15:01.000Z", "Not/A_Timezone"), "10:15 AM");
});
