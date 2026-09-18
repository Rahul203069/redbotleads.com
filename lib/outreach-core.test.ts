import assert from "node:assert/strict";
import test from "node:test";

import {
  OUTREACH_FOLLOW_UP_DELAY_MS,
  normalizeRedditUsername,
  resolveOutreachEligibility,
  validateOutreachMessage,
} from "./outreach-core";

test("normalizes Reddit usernames", () => {
  assert.equal(normalizeRedditUsername(" u/Some_User "), "some_user");
  assert.equal(normalizeRedditUsername("@Some-User"), "some-user");
});

test("resolves initial, cooldown, follow-up, and completed stages", () => {
  const now = new Date("2026-09-18T12:00:00.000Z");
  assert.deepEqual(resolveOutreachEligibility(null, now), { eligible: true, stage: "INITIAL" });
  assert.deepEqual(resolveOutreachEligibility({ firstSentAt: new Date(now.getTime() - 1000) }, now), {
    eligible: false,
    reason: "COOLDOWN",
  });
  assert.deepEqual(
    resolveOutreachEligibility({ firstSentAt: new Date(now.getTime() - OUTREACH_FOLLOW_UP_DELAY_MS) }, now),
    { eligible: true, stage: "FOLLOW_UP" },
  );
  assert.deepEqual(resolveOutreachEligibility({ firstSentAt: now, followUpSentAt: now }, now), {
    eligible: false,
    reason: "COMPLETED",
  });
});

test("requires the public link exactly once", () => {
  const url = "https://example.com/share/leads/campaign-1?range=all";
  assert.equal(validateOutreachMessage(`Useful context: ${url}`, url), null);
  assert.match(validateOutreachMessage("No link", url) ?? "", /exactly once/);
  assert.match(validateOutreachMessage(`${url} ${url}`, url) ?? "", /exactly once/);
});
