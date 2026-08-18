import { prisma } from "@/lib/prisma";
import {
  getDisabledDailyRssSubredditSet,
} from "@/lib/subreddit-polling-settings";
import {
  buildCampaignRssPollingSubreddits,
  buildDailyRssSubredditPool,
} from "@/lib/subreddit-name";

export type DailyRssSubredditPool = {
  allSubreddits: string[];
  disabledSubreddits: string[];
  enabledSubreddits: string[];
};

export async function getDailyRssSubredditPool(): Promise<DailyRssSubredditPool> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      rssPollingEnabled: true,
      subreddits: {
        isEmpty: false,
      },
    },
    select: {
      rssPollingEnabled: true,
      subreddits: true,
    },
  });
  const allSubreddits = buildCampaignRssPollingSubreddits(campaigns);
  const disabledSet = await getDisabledDailyRssSubredditSet(allSubreddits);

  return buildDailyRssSubredditPool(allSubreddits, disabledSet);
}
