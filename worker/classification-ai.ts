import { z } from "zod";

import { generateStructuredOutput } from "@/lib/openai";

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

const PROMPT_VERSION = "lead-classifier-v2";
const DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
const MIN_REQUEST_INTERVAL_MS = 1_000;

let lastRequestAt = 0;

export async function classifyLeadWithOpenAI(input: ClassificationInput): Promise<ClassificationResult> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured for the classification worker.");
  }

  await waitForRateLimitSlot();

  const { systemPrompt, userPrompt } = buildPrompt(input);
  const response = await generateStructuredOutput({
    model: DEFAULT_MODEL,
    schema: classificationResponseSchema,
    schemaName: "lead_classification",
    systemPrompt,
    temperature: 0.1,
    userPrompt,
  });
  const responseText = response.content;
  const parsedJson = parseJsonResponse(responseText);
  const parsed = classificationResultSchema.parse(parsedJson);

  return {
    ...parsed,
    model: response.model,
    promptVersion: PROMPT_VERSION,
  };
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
  return {
    systemPrompt: [
      "You classify Reddit posts for a B2B lead discovery SaaS.",
      "Your job is to detect product-specific commercial intent, not just general topical relevance.",
      "Judge the Reddit item against the actual campaign description first.",
      "A lead is only valuable if the author appears likely to buy, adopt, switch to, evaluate, or request a solution that fits the described product or service.",
      "Topical relevance alone is NOT enough.",
      "Generic buyer intent alone is also NOT enough if the described campaign offer is not a strong fit.",
      "Be strict and conservative.",
      "If the author is not clearly seeking help, evaluating options, frustrated with an unsolved problem, or considering switching, the score should usually be LOW.",
      "If the author has real intent but the described campaign offer does not actually match the need, score LOW or MED and explain the mismatch in the disqualifier.",
      "Do not invent facts.",
      "Judge only from the supplied text.",
      "Posts are usually LOW if they are mainly:",
      "- sharing a workflow or process",
      "- telling a story or case study",
      "- explaining what worked for them",
      "- promoting a product or service",
      "- discussing tools in general",
      "- describing an already solved problem",
      "- giving advice to others",
      "- asking broad discussion questions without solution-seeking intent",
      "Pain points must be short phrases, not full sentences.",
      "Summary must be concise and factual.",
      "Return only data that matches the provided JSON schema.",
    ].join(" "),

    userPrompt: [
      "Task:",
      "Classify whether this Reddit item is a real commercial lead for the campaign.",
      "First decide whether the need matches the described product or service.",
      "Then decide how strong the buying intent is.",
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
      "- LOW (0-44): broad discussion, education, storytelling, case study, workflow sharing, self-promotion, solved problem, unclear commercial intent, or weak fit to the campaign description.",
      "",
      "Important rules:",
      "- A post is NOT a lead just because it mentions the topic, tools, workflows, or pain points.",
      "- A post is NOT a strong lead unless the need is a plausible fit for the campaign description.",
      "- Posts about how someone currently does something are usually LOW unless they clearly express dissatisfaction or desire to switch.",
      "- Posts about a tool they built, use, or recommend to others are usually LOW unless the author is clearly seeking an alternative.",
      "- If the problem already seems solved, score LOW.",
      "- If intent is ambiguous, score LOW rather than MED.",
      "- If fit to the described product is ambiguous, score LOW rather than MED.",
      "- Use the disqualifier field to explain why a post is low fit, low intent, already solved, or mismatched to the campaign description.",
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
    },
    summary: {
      type: "string",
    },
    painPoints: {
      type: "array",
      items: {
        type: "string",
      },
      maxItems: 5,
    },
    disqualifier: {
      type: "string",
    },
  },
} as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
