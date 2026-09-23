export type LeadScoringModelId =
  | "gpt-4o-mini"
  | "gpt-4.1-mini"
  | "gpt-5-mini"
  | "gpt-5.1-mini"
  | "gpt-6-luna";

export type OpenAiModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
};

export type LeadScoringModelOption = OpenAiModelPricing & {
  id: LeadScoringModelId;
  label: string;
};

export const LEAD_SCORING_MODEL_OPTIONS: LeadScoringModelOption[] = [
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    inputPerMillion: 0.4,
    outputPerMillion: 1.6,
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    inputPerMillion: 0.25,
    outputPerMillion: 2,
  },
  {
    id: "gpt-5.1-mini",
    label: "GPT-5.1 mini",
    inputPerMillion: 0.25,
    outputPerMillion: 2,
  },
  {
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    inputPerMillion: 0.1,
    outputPerMillion: 0.5,
  },
];

export const DEFAULT_LEAD_SCORING_MODEL: LeadScoringModelId = "gpt-6-luna";

const leadScoringModelIds = new Set(LEAD_SCORING_MODEL_OPTIONS.map((model) => model.id));

export function isLeadScoringModelId(value: string): value is LeadScoringModelId {
  return leadScoringModelIds.has(value as LeadScoringModelId);
}

export function normalizeLeadScoringModel(value: string | null | undefined): LeadScoringModelId {
  const model = String(value ?? "").trim();
  return isLeadScoringModelId(model) ? model : DEFAULT_LEAD_SCORING_MODEL;
}

export function getOpenAiModelPricing(model: string): OpenAiModelPricing | null {
  return LEAD_SCORING_MODEL_OPTIONS.find((option) => option.id === model) ?? null;
}

export function getLeadScoringModelLabel(model: LeadScoringModelId) {
  return LEAD_SCORING_MODEL_OPTIONS.find((option) => option.id === model)?.label ?? model;
}

export function getLeadScoringRequestConfig(model: LeadScoringModelId) {
  return model === "gpt-6-luna"
    ? ({ reasoningEffort: "medium" } as const)
    : ({ temperature: 0.1 } as const);
}

export function formatModelPrice(value: number) {
  return `$${value.toFixed(value >= 1 ? 2 : 2)}/1M`;
}
