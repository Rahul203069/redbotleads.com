import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CAMPAIGN_LEAD_LAYOUT,
  normalizeCampaignLeadLayout,
} from "./campaign-lead-layout";

test("keeps the current lead page as the safe default", () => {
  assert.equal(DEFAULT_CAMPAIGN_LEAD_LAYOUT, "CLASSIC");
  assert.equal(normalizeCampaignLeadLayout(undefined), "CLASSIC");
  assert.equal(normalizeCampaignLeadLayout(null), "CLASSIC");
  assert.equal(normalizeCampaignLeadLayout("unexpected"), "CLASSIC");
});

test("accepts the inbox layout explicitly", () => {
  assert.equal(normalizeCampaignLeadLayout("INBOX"), "INBOX");
  assert.equal(normalizeCampaignLeadLayout("CLASSIC"), "CLASSIC");
});
