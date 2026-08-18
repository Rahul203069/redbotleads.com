export function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

export function normalizeSubredditNames(subreddits: string[]) {
  return Array.from(
    new Set(subreddits.map(normalizeSubredditName).filter(Boolean)),
  ).sort();
}

export function buildCampaignRssPollingSubreddits(
  campaigns: Array<{
    rssPollingEnabled: boolean;
    subreddits: string[];
  }>,
) {
  return normalizeSubredditNames(
    campaigns
      .filter((campaign) => campaign.rssPollingEnabled)
      .flatMap((campaign) => campaign.subreddits),
  );
}

export function buildDailyRssSubredditPool(
  subreddits: string[],
  disabledSubreddits: Iterable<string>,
) {
  const allSubreddits = normalizeSubredditNames(subreddits);
  const disabledSet = new Set(
    Array.from(disabledSubreddits, normalizeSubredditName).filter(Boolean),
  );
  const disabled = allSubreddits.filter((subreddit) => disabledSet.has(subreddit));

  return {
    allSubreddits,
    disabledSubreddits: disabled,
    enabledSubreddits: allSubreddits.filter((subreddit) => !disabledSet.has(subreddit)),
  };
}
