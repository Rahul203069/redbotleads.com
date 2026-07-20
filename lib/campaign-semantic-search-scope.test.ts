import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CAMPAIGN_SEMANTIC_SEARCH_SCOPE,
  buildCampaignSemanticSubredditPool,
  getCampaignSemanticSearchScopeLabel,
  parseCampaignSemanticSearchScope,
  resolveSubmittedCampaignSemanticSearchScope,
} from "./campaign-semantic-search-scope";

test("parses the supported campaign semantic search scopes", () => {
  assert.equal(parseCampaignSemanticSearchScope("CAMPAIGN"), "CAMPAIGN");
  assert.equal(parseCampaignSemanticSearchScope("GLOBAL"), "GLOBAL");
  assert.equal(parseCampaignSemanticSearchScope("OTHER"), null);
  assert.equal(parseCampaignSemanticSearchScope(undefined), null);
});

test("defaults new campaigns to campaign-linked subreddits", () => {
  assert.equal(DEFAULT_CAMPAIGN_SEMANTIC_SEARCH_SCOPE, "CAMPAIGN");
});

test("accepts admin scope changes and rejects invalid admin values", () => {
  assert.deepEqual(
    resolveSubmittedCampaignSemanticSearchScope({
      isAdminAccount: true,
      value: "GLOBAL",
    }),
    { status: "success", scope: "GLOBAL" },
  );
  assert.deepEqual(
    resolveSubmittedCampaignSemanticSearchScope({
      isAdminAccount: true,
      value: "OTHER",
    }),
    { status: "error" },
  );
});

test("ignores forged non-admin scope values and preserves missing update values", () => {
  assert.deepEqual(
    resolveSubmittedCampaignSemanticSearchScope({
      isAdminAccount: false,
      value: "GLOBAL",
    }),
    { status: "success", scope: undefined },
  );
  assert.deepEqual(
    resolveSubmittedCampaignSemanticSearchScope({
      isAdminAccount: true,
      value: null,
    }),
    { status: "success", scope: undefined },
  );
});

test("uses the linked-subreddit default when an admin creation form omits scope", () => {
  assert.deepEqual(
    resolveSubmittedCampaignSemanticSearchScope({
      defaultScope: DEFAULT_CAMPAIGN_SEMANTIC_SEARCH_SCOPE,
      isAdminAccount: true,
      value: null,
    }),
    { status: "success", scope: "CAMPAIGN" },
  );
});

test("labels both scopes for the admin interface", () => {
  assert.equal(getCampaignSemanticSearchScopeLabel("CAMPAIGN"), "Campaign subreddits");
  assert.equal(getCampaignSemanticSearchScopeLabel("GLOBAL"), "Global polling pool");
});

test("normalizes campaign subreddits and excludes globally disabled communities", () => {
  assert.deepEqual(
    buildCampaignSemanticSubredditPool({
      campaignSubreddits: ["r/SaaS", "/r/startups/", "SAAS", "smallbusiness"],
      disabledSubreddits: ["STARTUPS"],
    }),
    {
      allSubreddits: ["saas", "smallbusiness", "startups"],
      disabledSubreddits: ["startups"],
      enabledSubreddits: ["saas", "smallbusiness"],
    },
  );
});
