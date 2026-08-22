import { prisma } from "@/lib/prisma";
import { normalizeSaasAppMode, type SaasAppMode } from "@/lib/app-mode";
import {
  DEFAULT_CAMPAIGN_LEAD_LAYOUT,
  normalizeCampaignLeadLayout,
  type CampaignLeadLayout,
} from "@/lib/campaign-lead-layout";
import { DEFAULT_LEAD_SCORING_MODEL, normalizeLeadScoringModel, type LeadScoringModelId } from "@/lib/openai-models";
import {
  DEFAULT_SUBREDDIT_SUGGESTION_COUNT,
  MAX_SUBREDDIT_SUGGESTION_COUNT,
  MIN_SUBREDDIT_SUGGESTION_COUNT,
} from "@/lib/saas-config-constants";

export const SAAS_CONFIG_ID = "global";

export type SaasRuntimeConfig = {
  subredditSuggestionCount: number;
  leadScoringModel: LeadScoringModelId;
  campaignLeadLayout: CampaignLeadLayout;
  appMode: SaasAppMode;
};

export async function getSaasConfig(): Promise<SaasRuntimeConfig> {
  const config = await prisma.saasConfig.findUnique({
    where: {
      id: SAAS_CONFIG_ID,
    },
    select: {
      subredditSuggestionCount: true,
      leadScoringModel: true,
      campaignLeadLayout: true,
      appMode: true,
    },
  });

  return normalizeSaasConfig({
    subredditSuggestionCount: config?.subredditSuggestionCount,
    leadScoringModel: config?.leadScoringModel ?? process.env.OPENAI_MODEL,
    campaignLeadLayout: config?.campaignLeadLayout,
    appMode: config?.appMode,
  });
}

export async function upsertSaasConfig(
  input: Pick<SaasRuntimeConfig, "subredditSuggestionCount" | "leadScoringModel">,
) {
  const normalized = {
    subredditSuggestionCount: clampSubredditSuggestionCount(input.subredditSuggestionCount),
    leadScoringModel: normalizeLeadScoringModel(input.leadScoringModel),
  };

  return prisma.saasConfig.upsert({
    where: {
      id: SAAS_CONFIG_ID,
    },
    update: normalized,
    create: {
      id: SAAS_CONFIG_ID,
      ...normalized,
    },
  });
}

export async function upsertCampaignLeadLayout(input: CampaignLeadLayout) {
  const campaignLeadLayout = normalizeCampaignLeadLayout(input);

  return prisma.saasConfig.upsert({
    where: {
      id: SAAS_CONFIG_ID,
    },
    update: {
      campaignLeadLayout,
    },
    create: {
      id: SAAS_CONFIG_ID,
      campaignLeadLayout,
    },
  });
}

export async function upsertSaasAppMode(input: SaasAppMode) {
  const appMode = normalizeSaasAppMode(input);

  return prisma.saasConfig.upsert({
    where: { id: SAAS_CONFIG_ID },
    update: { appMode },
    create: { id: SAAS_CONFIG_ID, appMode },
  });
}

export function normalizeSaasConfig(input: {
  subredditSuggestionCount?: number | null;
  leadScoringModel?: string | null;
  campaignLeadLayout?: string | null;
  appMode?: string | null;
}): SaasRuntimeConfig {
  return {
    subredditSuggestionCount: clampSubredditSuggestionCount(input.subredditSuggestionCount),
    leadScoringModel: normalizeLeadScoringModel(input.leadScoringModel ?? DEFAULT_LEAD_SCORING_MODEL),
    campaignLeadLayout: normalizeCampaignLeadLayout(input.campaignLeadLayout ?? DEFAULT_CAMPAIGN_LEAD_LAYOUT),
    appMode: normalizeSaasAppMode(input.appMode, input.campaignLeadLayout),
  };
}

export function clampSubredditSuggestionCount(value: number | null | undefined) {
  const parsed = Number.isFinite(value) ? Math.round(Number(value)) : DEFAULT_SUBREDDIT_SUGGESTION_COUNT;
  return Math.min(MAX_SUBREDDIT_SUGGESTION_COUNT, Math.max(MIN_SUBREDDIT_SUGGESTION_COUNT, parsed));
}
