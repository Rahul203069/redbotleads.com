import type { DailyRssSubredditPool } from "@/lib/daily-rss-subreddit-pool";
import { buildDailyRssSubredditPool } from "@/lib/subreddit-name";

export const CAMPAIGN_SEMANTIC_SEARCH_SCOPES = ["CAMPAIGN", "GLOBAL"] as const;

export type CampaignSemanticSearchScope = (typeof CAMPAIGN_SEMANTIC_SEARCH_SCOPES)[number];

export const DEFAULT_CAMPAIGN_SEMANTIC_SEARCH_SCOPE: CampaignSemanticSearchScope = "CAMPAIGN";

export function parseCampaignSemanticSearchScope(value: unknown): CampaignSemanticSearchScope | null {
  return value === "CAMPAIGN" || value === "GLOBAL" ? value : null;
}

export function resolveSubmittedCampaignSemanticSearchScope(input: {
  defaultScope?: CampaignSemanticSearchScope;
  isAdminAccount: boolean;
  value: unknown;
}):
  | { status: "success"; scope: CampaignSemanticSearchScope | undefined }
  | { status: "error" } {
  if (!input.isAdminAccount) {
    return { status: "success", scope: undefined };
  }

  if (input.value === null || input.value === undefined) {
    return { status: "success", scope: input.defaultScope };
  }

  const scope = parseCampaignSemanticSearchScope(input.value);
  return scope ? { status: "success", scope } : { status: "error" };
}

export function getCampaignSemanticSearchScopeLabel(scope: CampaignSemanticSearchScope) {
  return scope === "GLOBAL" ? "Global polling pool" : "Campaign subreddits";
}

export function buildCampaignSemanticSubredditPool(input: {
  campaignSubreddits: string[];
  disabledSubreddits: Iterable<string>;
}): DailyRssSubredditPool {
  return buildDailyRssSubredditPool(input.campaignSubreddits, input.disabledSubreddits);
}
