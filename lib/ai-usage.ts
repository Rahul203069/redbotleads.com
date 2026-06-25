import { Prisma } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getOpenAiModelPricing, type OpenAiModelPricing } from "@/lib/openai-models";

export type AiUsageContext = {
  userId?: string | null;
  campaignId?: string | null;
  campaignRunId?: string | null;
  operation: string;
  metadata?: Record<string, unknown>;
};

export type AiUsageTokens = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

const EXTRA_DEFAULT_PRICING: Record<string, OpenAiModelPricing> = {
  "text-embedding-3-small": {
    inputPerMillion: 0.02,
    outputPerMillion: 0,
  },
};

export async function recordAiUsage({
  context,
  model,
  tokens,
}: {
  context?: AiUsageContext;
  model: string;
  tokens: AiUsageTokens;
}) {
  if (!context?.userId) {
    return null;
  }

  const inputTokens = normalizeTokenCount(tokens.inputTokens);
  const outputTokens = normalizeTokenCount(tokens.outputTokens);
  const totalTokens = normalizeTokenCount(tokens.totalTokens) ?? inputTokens + outputTokens;
  const costUsd = calculateOpenAiCostUsd({
    inputTokens,
    model,
    outputTokens,
    totalTokens,
  });

  const event = await prisma.aiUsageEvent.create({
    data: {
      userId: context.userId,
      campaignId: context.campaignId || null,
      campaignRunId: context.campaignRunId || null,
      operation: context.operation,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
      metadataJson: context.metadata ? (context.metadata as Prisma.InputJsonValue) : undefined,
    },
    select: {
      id: true,
      campaignRunId: true,
      costUsd: true,
    },
  });

  if (event.campaignRunId) {
    await refreshCampaignRunCost(event.campaignRunId);
  }

  return event;
}

export async function refreshCampaignRunCost(campaignRunId: string) {
  const aggregate = await prisma.aiUsageEvent.aggregate({
    where: {
      campaignRunId,
    },
    _sum: {
      costUsd: true,
    },
  });

  await prisma.campaignRun.update({
    where: {
      id: campaignRunId,
    },
    data: {
      totalCostUsd: aggregate._sum.costUsd ?? 0,
    },
  });
}

function calculateOpenAiCostUsd({
  inputTokens,
  model,
  outputTokens,
  totalTokens,
}: {
  inputTokens: number;
  model: string;
  outputTokens: number;
  totalTokens: number;
}) {
  const pricing = getPricingForModel(model);

  if (!pricing) {
    return 0;
  }

  const billableInputTokens = inputTokens > 0 ? inputTokens : totalTokens;
  const inputCost = (billableInputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return Number((inputCost + outputCost).toFixed(8));
}

function getPricingForModel(model: string) {
  const customPricing = parseCustomPricing(process.env.OPENAI_MODEL_PRICING_JSON);
  return customPricing[model] ?? getOpenAiModelPricing(model) ?? EXTRA_DEFAULT_PRICING[model] ?? null;
}

function parseCustomPricing(value: string | undefined) {
  if (!value?.trim()) {
    return {};
  }

  try {
    return JSON.parse(value) as Record<string, OpenAiModelPricing>;
  } catch {
    return {};
  }
}

function normalizeTokenCount(value: number | null | undefined) {
  return Number.isFinite(value) && value && value > 0 ? Math.round(value) : 0;
}
