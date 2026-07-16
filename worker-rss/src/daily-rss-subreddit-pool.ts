import { prisma } from "./prisma";
import { getDisabledDailyRssSubredditSet } from "./subreddit-polling-settings";

export async function getDailyRssSubredditPool() {
  const campaigns = await prisma.campaign.findMany({
    where: {
      isActive: true,
      subreddits: {
        isEmpty: false,
      },
    },
    select: {
      subreddits: true,
    },
  });
  const allSubreddits = Array.from(
    new Set(
      campaigns
        .flatMap((campaign) => campaign.subreddits)
        .map(normalizeSubredditName)
        .filter(Boolean),
    ),
  ).sort();
  const disabledSet = await getDisabledDailyRssSubredditSet(allSubreddits);

  return {
    allSubreddits,
    enabledSubreddits: allSubreddits.filter((subreddit) => !disabledSet.has(subreddit)),
  };
}

function normalizeSubredditName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/^r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}
