import assert from "node:assert/strict";
import test from "node:test";

import {
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
