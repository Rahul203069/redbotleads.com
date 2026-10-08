import { prisma } from "./prisma";

export const NUVECA_FIRST_CAMPAIGN_ID = "cmrxf5i36000004l16u27gj35";

export async function isNuvecaRssSubreddit(subreddit: string) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: NUVECA_FIRST_CAMPAIGN_ID,
      isActive: true,
      rssPollingEnabled: true,
    },
    select: { subreddits: true },
  });

  return Boolean(campaign?.subreddits.some((name) => normalize(name) === subreddit));
}

function normalize(value: string) {
  return value.trim().replace(/^\/?r\//i, "").replace(/^\/+|\/+$/g, "").toLowerCase();
}
