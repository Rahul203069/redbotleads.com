import { z } from "zod";

import { generateStructuredOutput } from "@/lib/openai";
import { DEFAULT_LEAD_SCORING_MODEL } from "@/lib/openai-models";
import { getSaasConfig } from "@/lib/saas-config";
import { workerClassificationMinIntervalMs } from "./config";
import { workerLogger } from "./logger";

const classificationResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  label: z.enum(["HIGH", "MED", "LOW"]),
  intentType: z.enum(["none", "implicit", "explicit", "switching"]),
  buyerStage: z.enum(["solved", "problem_aware", "solution_aware", "evaluating"]),
  category: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(400),
  painPoints: z.array(z.string().trim().min(1).max(120)).max(5),
  disqualifier: z.string().trim().max(200),
});

type ClassificationInput = {
  userId?: string | null;
  campaignId?: string | null;
  campaignRunId?: string | null;
  campaign: {
    name: string;
    leadType: "PRODUCT" | "SERVICE";
    description: string | null;
    keywords: string[];
    negativeKeywords: string[];
    subreddits: string[];
  };
  redditItem: {
    type: "POST" | "COMMENT";
    subreddit: string;
    title: string | null;
    description: string | null;
    body: string | null;
    author: string | null;
    url: string | null;
  };
};

type ClassificationResult = z.infer<typeof classificationResultSchema> & {
  model: string;
  promptVersion: string;
};

const PRODUCT_PROMPT_VERSION = "lead-classifier-v3-product";
const SERVICE_PROMPT_VERSION = "lead-classifier-v2-service";
const ENV_DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || DEFAULT_LEAD_SCORING_MODEL;
const MIN_REQUEST_INTERVAL_MS = workerClassificationMinIntervalMs;
const MAX_CATEGORY_LENGTH = 80;
const MAX_SUMMARY_LENGTH = 400;
const MAX_PAIN_POINT_LENGTH = 120;
const MAX_PAIN_POINTS = 5;
const MAX_DISQUALIFIER_LENGTH = 200;

let lastRequestAt = 0;

export async function classifyLeadWithOpenAI(input: ClassificationInput): Promise<ClassificationResult> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured for the classification worker.");
  }

  await waitForRateLimitSlot();

  const { systemPrompt, userPrompt } = buildPrompt(input);
  const model = await getLeadScoringModel();
  const response = await generateStructuredOutput({
    model,
    schema: classificationResponseSchema,
    schemaName: "lead_classification",
    systemPrompt,
    temperature: 0.1,
    userPrompt,
    usage: {
      userId: input.userId,
      campaignId: input.campaignId,
      campaignRunId: input.campaignRunId,
      operation: "lead_classification",
    },
  });
  const responseText = response.content;
  const parsedJson = parseJsonResponse(responseText);
  const parsed = classificationResultSchema.parse(normalizeClassificationResponse(parsedJson));

  return {
    ...parsed,
    model: response.model,
    promptVersion: input.campaign.leadType === "PRODUCT" ? PRODUCT_PROMPT_VERSION : SERVICE_PROMPT_VERSION,
  };
}

async function getLeadScoringModel() {
  try {
    const config = await getSaasConfig();
    return config.leadScoringModel;
  } catch (error) {
    workerLogger.warn({ error }, "SaaS config lookup failed for lead classification; using env/default model");
    return ENV_DEFAULT_MODEL;
  }
}

async function waitForRateLimitSlot() {
  const now = Date.now();
  const waitMs = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - now);

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  lastRequestAt = Date.now();
}

function buildPrompt(input: ClassificationInput) {
  if (input.campaign.leadType === "PRODUCT") {
    return buildProductPrompt(input);
  }

  return buildServicePrompt(input);
}

function buildServicePrompt(input: ClassificationInput) {
  return {
    systemPrompt: [
      "You classify Reddit posts for a B2B lead discovery SaaS.",
      "",
      "Your job is to detect real commercial intent for the described service campaign, not just general topical relevance.",
      "",
      "Judge the Reddit item against the campaign description first.",
      "",
      "A lead is valuable only if the author appears likely to request help, hire outside support, outsource work, evaluate providers, or clearly needs a service that fits the described campaign.",
      "",
      "Topical relevance alone is NOT enough.",
      "Generic pain alone is NOT enough.",
      "Generic buyer intent alone is NOT enough if the campaign offer is not a strong fit.",
      "",
      "Be strict and conservative.",
      "",
      "If the author is not clearly seeking help, asking for recommendations, frustrated with an unsolved problem, considering outside help, or likely to need implementation/support, the score should usually be LOW.",
      "",
      "If the author has real pain but the described service is not actually a strong fit, score LOW or MED and explain the mismatch in the disqualifier.",
      "",
      "Do not invent facts.",
      "Judge only from the supplied text.",
      "",
      "Posts are usually LOW if they are mainly:",
      "- sharing a workflow or process",
      "- telling a story or case study",
      "- explaining what worked for them",
      "- promoting a product or service",
      "- discussing tools in general",
      "- describing an already solved problem",
      "- giving advice to others",
      "- asking broad discussion questions without help-seeking intent",
      "- looking for a full-time employee",
      "- looking for a job",
      "",
      "Pain points must be short phrases, not full sentences.",
      "Summary must be concise and factual.",
      "Return only data that matches the provided JSON schema.",
    ].join("\n"),

    userPrompt: [
      "Task:",
      "Classify whether this Reddit item is a real commercial lead for the campaign.",
      "",
      "First decide whether the need matches the described service.",
      "Then decide how strong the help-seeking, outsourcing, or buying intent is.",
      "",
      "Output fields:",
      "1. score: integer from 0 to 100",
      "2. label: HIGH, MED, or LOW",
      "3. intentType: none, implicit, explicit, or switching",
      "4. buyerStage: solved, problem_aware, solution_aware, or evaluating",
      "5. category: short category label",
      "6. summary: concise summary",
      "7. painPoints: up to 5 short pain points or buying signals",
      "8. disqualifier: short reason if this is not a strong lead",
      "",
      "Scoring guidance:",
      "- HIGH (80-100): clear help-seeking, provider-search, recommendation, outsourcing, implementation, setup, or expert-support intent, and the need strongly matches the campaign description.",
      "- MED (45-79): real unsolved commercial pain is present and relevant to the campaign, but the author does not clearly ask for help yet, or the fit is only partial.",
      "- LOW (0-44): broad discussion, education, storytelling, case study, workflow sharing, self-promotion, solved problem, unclear commercial intent, weak fit, job-seeking, or full-time hiring.",
      "",
      "Important rules:",
      "- A post is NOT a lead just because it mentions the topic, tools, workflows, or pain points.",
      "- A post is NOT a strong lead unless the need is a plausible fit for the campaign description.",
      "- Prefer signals like: asking for help, asking who can do this, asking for provider recommendations, describing painful manual work, considering outsourcing, wanting setup help, implementation help, or being clearly overwhelmed by an unsolved workflow.",
      "- Posts about how someone currently does something are usually LOW unless they clearly express dissatisfaction, overload, or desire to change.",
      "- Posts about a tool they built, use, or recommend are usually LOW unless the author is clearly seeking help, replacement, or outside support.",
      "- If the problem already seems solved, score LOW.",
      "- If intent is ambiguous, score LOW rather than MED.",
      "- If fit to the campaign is ambiguous, score LOW rather than MED.",
      "- Use the disqualifier field to explain why a post is low fit, low intent, already solved, job-related, or mismatched to the campaign description.",
      "",
      "Intent definitions:",
      "- none: no evidence the author wants a solution or help",
      "- implicit: pain exists but request is indirect",
      "- explicit: direct request for recommendation, provider, service, expert help, agency, freelancer, consultant, or implementation help",
      "- switching: clear dissatisfaction with current method, tool, provider, or internal process and desire to replace, improve, or hand off the work",
      "",
      "Buyer stage definitions:",
      "- solved: they already have an approach or solution and are not looking",
      "- problem_aware: they clearly feel pain but are not yet asking for solutions or help",
      "- solution_aware: they are discussing ways to solve it, including tools, services, or workflows",
      "- evaluating: they are actively comparing options, requesting recommendations, considering outside help, or deciding how to solve it",
      "",
      "Fit guidance:",
      "- Use the campaign description as the primary reference for what counts as a good lead.",
      "- If the Reddit item describes a different problem, different buyer, or different workflow than the campaign description, lower the score.",
      "- Only score HIGH when both fit and intent are strong.",
      "",
      `Campaign name: ${input.campaign.name}`,
      `Lead type: ${input.campaign.leadType}`,
      `Campaign description: ${input.campaign.description ?? "None"}`,
      `Campaign keywords: ${input.campaign.keywords.join(", ") || "None"}`,
      `Campaign negative keywords: ${input.campaign.negativeKeywords.join(", ") || "None"}`,
      `Target subreddits: ${input.campaign.subreddits.join(", ") || "None"}`,
      "",
      `Reddit item type: ${input.redditItem.type}`,
      `Subreddit: r/${input.redditItem.subreddit}`,
      `Title: ${input.redditItem.title ?? ""}`,
      `Description: ${input.redditItem.description ?? ""}`,
      `Body: ${input.redditItem.body ?? ""}`,
      `Author: ${input.redditItem.author ?? "Unknown"}`,
      `URL: ${input.redditItem.url ?? "Unknown"}`,
    ].join("\n"),
  };
}

function buildProductPrompt(input: ClassificationInput) {
  return {
    systemPrompt: [
      "You classify Reddit posts for a B2B lead discovery SaaS.",
      "",
      "Your job is to detect product-specific commercial intent, not just general topical relevance.",
      "",
      "Judge the Reddit item against the actual campaign description first.",
      "",
      "A lead is only valuable if the author appears likely to buy, adopt, switch to, evaluate, or request a solution that fits the described product or service.",
      "",
      "Topical relevance alone is NOT enough.",
      "",
      "Generic buyer intent alone is also NOT enough if the described campaign offer is not a strong fit.",
      "",
      "Be strict and conservative.",
      "",
      "If the author is not clearly seeking help, evaluating options, frustrated with an unsolved problem, or considering switching, the score should usually be LOW.",
      "",
      "If the author has real intent but the described campaign offer does not actually match the need, score LOW or MED and explain the mismatch in the disqualifier.",
      "",
      "Do not invent facts.",
      "Judge only from the supplied text.",
      "",
      "Posts are usually LOW if they are mainly:",
      "- sharing a workflow or process",
      "- telling a story or case study",
      "- explaining what worked for them",
      "- promoting a product or service",
      "- discussing tools in general",
      "- describing an already solved problem",
      "- giving advice to others",
      "- asking broad discussion questions without solution-seeking intent",
      "",
      "Pain points must be short phrases, not full sentences.",
      "Summary must be concise and factual.",
      "Return only data that matches the provided JSON schema.",
    ].join("\n"),

    userPrompt: [
      "Task:",
      "Classify whether this Reddit item is a real commercial lead for the campaign.",
      "",
      "First decide whether the Reddit item's need matches the described product or service.",
      "Then decide how strong the buying intent is.",
      "Then consider any qualification requirements such as target region, budget, company size, industry, buyer type, or deal size.",
      "",
      "Output fields:",
      "1. score: integer from 0 to 100",
      "2. label: HIGH, MED, or LOW",
      "3. intentType: none, implicit, explicit, or switching",
      "4. buyerStage: solved, problem_aware, solution_aware, or evaluating",
      "5. category: short category label",
      "6. summary: concise summary",
      "7. painPoints: up to 5 short pain points or buying signals",
      "8. disqualifier: short reason if this is not a strong lead",
      "",
      "Scoring guidance:",
      "- HIGH (80-100): clear buying, recommendation, evaluation, or switching intent, and the need strongly matches the campaign description.",
      "- MED (45-79): real unsolved commercial pain is present and relevant to the campaign, but the author does not clearly ask for a solution yet, or the fit is only partial.",
      "- LOW (0-44): broad discussion, education, storytelling, case study, workflow sharing, self-promotion, solved problem, unclear commercial intent, weak fit to the campaign description, or clear contradiction with an important campaign requirement.",
      "",
      "Important rules:",
      "- A post is NOT a lead just because it mentions the topic, tools, workflows, or pain points.",
      "- A post is NOT a strong lead unless the need is a plausible fit for the campaign description.",
      "- Posts about how someone currently does something are usually LOW unless they clearly express dissatisfaction or desire to switch.",
      "- Posts about a tool they built, use, or recommend to others are usually LOW unless the author is clearly seeking an alternative.",
      "- If the problem already seems solved, score LOW.",
      "- If intent is ambiguous, score LOW rather than MED.",
      "- If fit to the described product is ambiguous, score LOW rather than MED.",
      "- Use the disqualifier field to explain why a post is low fit, low intent, already solved, mismatched, or clearly contradicts an important campaign requirement.",
      "",
      "Qualification rules:",
      "The campaign description may include target qualifiers such as region, country, budget, company size, industry, buyer type, deal size, or target customer profile.",
      "",
      "Do not require every qualifier to be explicitly mentioned in the Reddit item.",
      "",
      "Missing qualifier information is NOT a disqualifier.",
      "",
      "Only penalize a lead when the Reddit item clearly contradicts an important qualifier in the campaign description.",
      "",
      "Classify qualifier evidence internally like this:",
      "",
      "- MATCHED: the Reddit item clearly satisfies the qualifier.",
      "- PROBABLY_MATCHED: strong indirect evidence suggests it likely satisfies the qualifier.",
      "- UNKNOWN: the Reddit item does not provide enough information.",
      "- PROBABLY_MISMATCHED: weak evidence suggests it may not satisfy the qualifier.",
      "- MISMATCHED: the Reddit item clearly contradicts the qualifier.",
      "",
      "Rules for unknown qualifiers:",
      "",
      "- If region is unknown, do not penalize.",
      "- If budget is unknown, do not penalize.",
      "- If company size is unknown, do not penalize.",
      "- If industry is unknown, do not penalize unless the campaign requires a very specific industry and the Reddit item clearly belongs to another industry.",
      "- If buyer type is unknown but the problem and intent strongly fit, do not reject automatically.",
      "",
      "Rules for clear mismatches:",
      "",
      "- If the campaign targets USA only and the Reddit item clearly says the buyer is in another unsupported country, score LOW and explain in disqualifier.",
      "- If the campaign targets buyers with $1000+ budget and the Reddit item clearly says the budget is far below that, score LOW and explain in disqualifier.",
      "- If the campaign targets businesses but the Reddit item is clearly from a student, hobbyist, or non-commercial user, lower the score.",
      "- If the campaign targets agencies/B2B teams but the Reddit item is clearly about personal use only, lower the score.",
      "- If the Reddit item clearly describes a different buyer, different workflow, or different use case than the campaign, lower the score.",
      "",
      "Important qualifier principle:",
      "Do not turn \"best-fit customer\" requirements into hard rejection rules unless the Reddit item clearly contradicts them.",
      "",
      "Examples:",
      "",
      "- Campaign targets US businesses. Reddit item does not mention location -> do not penalize.",
      "- Campaign targets US businesses. Reddit item says the buyer is in Switzerland -> LOW, clear region mismatch.",
      "- Campaign targets $1000+ budget. Reddit item does not mention budget -> do not penalize.",
      "- Campaign targets $1000+ budget. Reddit item says budget is $50 -> LOW, clear budget mismatch.",
      "- Campaign targets B2B companies. Reddit item asks for a business solution but does not mention company size -> do not penalize.",
      "- Campaign targets agencies. Reddit item is clearly a solo student project -> lower score.",
      "",
      "Intent definitions:",
      "- none: no evidence the author wants a solution",
      "- implicit: pain exists but request is indirect",
      "- explicit: direct request for recommendation, tool, service, or help",
      "- switching: clear dissatisfaction with current method or tool and desire to replace it",
      "",
      "Buyer stage definitions:",
      "- solved: they already have an approach or solution and are not looking",
      "- problem_aware: they clearly feel pain but are not yet asking for solutions",
      "- solution_aware: they are discussing tools or ways to solve it",
      "- evaluating: they are actively comparing, requesting, or considering options",
      "",
      "Fit guidance:",
      "- Use the campaign description as the primary reference for what counts as a good lead.",
      "- If the Reddit item describes a different problem, different buyer, or different workflow than the campaign description, lower the score.",
      "- Only score HIGH when both fit and intent are strong.",
      "- Do not score LOW only because region, budget, company size, or other qualification details are missing.",
      "- Score LOW when the Reddit item clearly contradicts an important campaign requirement.",
      "",
      `Campaign name: ${input.campaign.name}`,
      `Lead type: ${input.campaign.leadType}`,
      `Campaign description: ${input.campaign.description ?? "None"}`,
      `Campaign keywords: ${input.campaign.keywords.join(", ") || "None"}`,
      `Campaign negative keywords: ${input.campaign.negativeKeywords.join(", ") || "None"}`,
      `Target subreddits: ${input.campaign.subreddits.join(", ") || "None"}`,
      "",
      `Reddit item type: ${input.redditItem.type}`,
      `Subreddit: r/${input.redditItem.subreddit}`,
      `Title: ${input.redditItem.title ?? ""}`,
      `Description: ${input.redditItem.description ?? ""}`,
      `Body: ${input.redditItem.body ?? ""}`,
      `Author: ${input.redditItem.author ?? "Unknown"}`,
      `URL: ${input.redditItem.url ?? "Unknown"}`,
    ].join("\n"),
  };
}

function parseJsonResponse(text: string) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned) as unknown;
}

function normalizeClassificationResponse(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;

  return {
    ...record,
    category: clampString(record.category, MAX_CATEGORY_LENGTH),
    summary: clampString(record.summary, MAX_SUMMARY_LENGTH),
    painPoints: normalizePainPoints(record.painPoints),
    disqualifier: clampString(record.disqualifier, MAX_DISQUALIFIER_LENGTH),
  };
}

function normalizePainPoints(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .map((item) => clampString(item, MAX_PAIN_POINT_LENGTH))
    .filter((item) => item.length > 0)
    .slice(0, MAX_PAIN_POINTS);
}

function clampString(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

const classificationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "label", "intentType", "buyerStage", "category", "summary", "painPoints", "disqualifier"],
  properties: {
    score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    label: {
      type: "string",
      enum: ["HIGH", "MED", "LOW"],
    },
    intentType: {
      type: "string",
      enum: ["none", "implicit", "explicit", "switching"],
    },
    buyerStage: {
      type: "string",
      enum: ["solved", "problem_aware", "solution_aware", "evaluating"],
    },
    category: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CATEGORY_LENGTH,
    },
    summary: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SUMMARY_LENGTH,
    },
    painPoints: {
      type: "array",
      items: {
        type: "string",
        minLength: 1,
        maxLength: MAX_PAIN_POINT_LENGTH,
      },
      maxItems: MAX_PAIN_POINTS,
    },
    disqualifier: {
      type: "string",
      maxLength: MAX_DISQUALIFIER_LENGTH,
    },
  },
} as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
