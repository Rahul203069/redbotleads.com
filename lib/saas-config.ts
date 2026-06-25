import { prisma } from "@/lib/prisma";
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
};

export async function getSaasConfig(): Promise<SaasRuntimeConfig> {
  const config = await prisma.saasConfig.findUnique({
    where: {
      id: SAAS_CONFIG_ID,
    },
    select: {
      subredditSuggestionCount: true,
      leadScoringModel: true,
    },
  });

  return normalizeSaasConfig({
    subredditSuggestionCount: config?.subredditSuggestionCount,
    leadScoringModel: config?.leadScoringModel ?? process.env.OPENAI_MODEL,
  });
}

export async function upsertSaasConfig(input: SaasRuntimeConfig) {
  const normalized = normalizeSaasConfig(input);

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

export function normalizeSaasConfig(input: {
  subredditSuggestionCount?: number | null;
  leadScoringModel?: string | null;
}): SaasRuntimeConfig {
  return {
    subredditSuggestionCount: clampSubredditSuggestionCount(input.subredditSuggestionCount),
    leadScoringModel: normalizeLeadScoringModel(input.leadScoringModel ?? DEFAULT_LEAD_SCORING_MODEL),
  };
}

export function clampSubredditSuggestionCount(value: number | null | undefined) {
  const parsed = Number.isFinite(value) ? Math.round(Number(value)) : DEFAULT_SUBREDDIT_SUGGESTION_COUNT;
  return Math.min(MAX_SUBREDDIT_SUGGESTION_COUNT, Math.max(MIN_SUBREDDIT_SUGGESTION_COUNT, parsed));
}
