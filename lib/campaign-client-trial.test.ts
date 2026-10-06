import assert from "node:assert/strict";
import test from "node:test";

import { isCampaignClientTrialExpired } from "./campaign-client-trial";

test("client trial expires exactly seven days after access is created", () => {
  const linkedAt = new Date("2026-09-01T12:30:00.000Z");

  assert.equal(isCampaignClientTrialExpired(linkedAt, new Date("2026-09-08T12:29:59.999Z")), false);
  assert.equal(isCampaignClientTrialExpired(linkedAt, new Date("2026-09-08T12:30:00.000Z")), true);
  assert.equal(isCampaignClientTrialExpired(linkedAt, new Date("2026-10-06T00:00:00.000Z")), true);
});
