import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCampaignRssPollingSubreddits,
  buildDailyRssSubredditPool,
  normalizeSubredditNames,
} from "./subreddit-name";

test("normalizes, deduplicates, and sorts the shared daily RSS subreddit pool", () => {
  assert.deepEqual(
    normalizeSubredditNames([
      "r/SaaS",
      " /r/startups/ ",
      "SAAS",
      "",
      "smallbusiness",
    ]),
    ["saas", "smallbusiness", "startups"],
  );
});

test("excludes globally disabled subreddits from the enabled polling pool", () => {
  assert.deepEqual(
    buildDailyRssSubredditPool(
      ["r/SaaS", "startups", "smallbusiness"],
      ["/r/STARTUPS/"],
    ),
    {
      allSubreddits: ["saas", "smallbusiness", "startups"],
      disabledSubreddits: ["startups"],
      enabledSubreddits: ["saas", "smallbusiness"],
    },
  );
});

test("builds the shared pool from RSS-enabled campaigns independently of campaign activity", () => {
  assert.deepEqual(
    buildCampaignRssPollingSubreddits([
      {
        rssPollingEnabled: true,
        subreddits: ["r/SaaS", "startups"],
      },
      {
        rssPollingEnabled: false,
        subreddits: ["smallbusiness", "sales"],
      },
    ]),
    ["saas", "startups"],
  );
});

test("keeps a shared subreddit when at least one campaign has RSS fetching enabled", () => {
  assert.deepEqual(
    buildCampaignRssPollingSubreddits([
      {
        rssPollingEnabled: false,
        subreddits: ["SaaS"],
      },
      {
        rssPollingEnabled: true,
        subreddits: ["r/saas", "Entrepreneur"],
      },
    ]),
    ["entrepreneur", "saas"],
  );
});
