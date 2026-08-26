import assert from "node:assert/strict";
import test from "node:test";

import { formatCampaignDescriptionReviewMessage } from "./campaign-description-review";

test("formats a campaign description review alert with the user and campaign", () => {
  const message = formatCampaignDescriptionReviewMessage({
    campaignName: "Nuveca Freight Leads",
    userEmail: "client@example.com",
  });

  assert.match(message, /User: client@example\.com/);
  assert.match(message, /Campaign: Nuveca Freight Leads/);
  assert.match(message, /manually update the semantic queries and related backend targeting/);
});

test("uses a safe fallback when the signed-in account has no email", () => {
  const message = formatCampaignDescriptionReviewMessage({
    campaignName: "Freight Leads",
    userEmail: null,
  });

  assert.match(message, /User: Email unavailable/);
});
