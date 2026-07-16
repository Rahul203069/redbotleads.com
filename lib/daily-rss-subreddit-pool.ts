import { prisma } from "@/lib/prisma";
import {
  getDisabledDailyRssSubredditSet,
} from "@/lib/subreddit-polling-settings";
import {
  buildDailyRssSubredditPool,
  normalizeSubredditNames,
} from "@/lib/subreddit-name";

export type DailyRssSubredditPool = {
  allSubreddits: string[];
  disabledSubreddits: string[];
  enabledSubreddits: string[];
};

export async function getDailyRssSubredditPool(): Promise<DailyRssSubredditPool> {
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
  const allSubreddits = normalizeSubredditNames(
    campaigns.flatMap((campaign) => campaign.subreddits),
  );
  const disabledSet = await getDisabledDailyRssSubredditSet(allSubreddits);

  return buildDailyRssSubredditPool(allSubreddits, disabledSet);
}
