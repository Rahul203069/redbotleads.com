import { prisma } from "@/lib/prisma";
import { getDisabledDailyRssSubredditSet } from "@/lib/subreddit-polling-settings";
import { normalizeSubredditNames } from "@/lib/subreddit-name";

export const NUVECA_FIRST_CAMPAIGN_ID = "cmrxf5i36000004l16u27gj35";
export const NUVECA_RSS_QUEUE_NAME = "rss-polling-nuveca-first";

export async function getNuvecaRssSubredditPool() {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: NUVECA_FIRST_CAMPAIGN_ID,
      isActive: true,
      rssPollingEnabled: true,
    },
    select: { subreddits: true },
  });
  const allSubreddits = normalizeSubredditNames(campaign?.subreddits ?? []);
  const disabled = await getDisabledDailyRssSubredditSet(allSubreddits);

  return {
    allSubreddits,
    enabledSubreddits: allSubreddits.filter((subreddit) => !disabled.has(subreddit)),
  };
}
