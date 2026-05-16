import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { generateStructuredOutput } from "@/lib/openai";

const requestSchema = z.object({
  description: z.string().trim().min(10, "Add a more descriptive campaign description first."),
  leadType: z.enum(["PRODUCT", "SERVICE"]),
  idealClient: z.string().trim().optional(),
  painPoints: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  existing: z.array(z.string()).default([]),
});

const TARGET_SUBREDDIT_SUGGESTIONS = 40;
const MAX_SUBREDDIT_SUGGESTION_ATTEMPTS = 3;
const SUBREDDIT_DISCOVERY_MODEL =
  process.env.OPENAI_SUBREDDIT_MODEL?.trim() || process.env.OPENAI_WEB_SEARCH_MODEL?.trim() || "gpt-5-mini";
const SUBREDDIT_WEB_SEARCH_CONTEXT_SIZE = parseSearchContextSize(
  process.env.OPENAI_SUBREDDIT_WEB_SEARCH_CONTEXT_SIZE?.trim(),
);
const SUBREDDIT_VALIDATION_TIMEOUT_MS = Number.parseInt(
  process.env.OPENAI_SUBREDDIT_VALIDATION_TIMEOUT_MS?.trim() || "8000",
  10,
);
const DEFAULT_REDDIT_USER_AGENT = "my-app-subreddit-discovery/0.1";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },
} as const;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors[0] ?? "Invalid request." }, { status: 400 });
  }

  try {
    const existing = new Set(parsed.data.existing.map(normalizeSubreddit));
    const normalizedCandidates = await collectSubredditSuggestions(parsed.data, existing);
    console.info("Subreddit suggestion normalized candidates", {
      count: normalizedCandidates.length,
      suggestions: normalizedCandidates,
    });
    const validated = await filterReachableSubreddits(normalizedCandidates);
    const finalSuggestions =
      validated.length >= TARGET_SUBREDDIT_SUGGESTIONS
        ? validated.slice(0, TARGET_SUBREDDIT_SUGGESTIONS)
        : normalizedCandidates.slice(0, TARGET_SUBREDDIT_SUGGESTIONS);
    console.info("Subreddit suggestion final response", {
      count: finalSuggestions.length,
      suggestions: finalSuggestions,
    });

    return NextResponse.json({ suggestions: finalSuggestions });
  } catch (error) {
    console.error("OpenAI subreddit suggestion failed", error);

    return NextResponse.json({ error: getSuggestionErrorMessage(error) }, { status: 500 });
  }
}

function normalizeSubreddit(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\/?r\//i, "")
    .replace(/^\/+|\/+$/g, "");
}

function parseSearchContextSize(value: string | undefined) {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

async function filterReachableSubreddits(subreddits: string[]) {
  if (subreddits.length === 0) {
    console.warn("Subreddit validation skipped because there were no candidates.");
    return [];
  }

  const results = await Promise.all(
    subreddits.map(async (subreddit) => ({
      subreddit,
      status: await getPublicSubredditReachability(subreddit),
    })),
  );

  const hadCompletedValidation = results.some((result) => result.status !== "error");
  const reachable = results
    .filter((result) => result.status === "reachable")
    .map((result) => result.subreddit);
  console.info("Subreddit validation results", {
    total: results.length,
    reachable: reachable.length,
    results,
  });

  if (hadCompletedValidation) {
    if (reachable.length > 0) {
      return reachable.slice(0, TARGET_SUBREDDIT_SUGGESTIONS);
    }

    console.warn("Subreddit validation completed but removed every candidate; returning unvalidated suggestions.");
    return subreddits.slice(0, TARGET_SUBREDDIT_SUGGESTIONS);
  }

  console.warn("Subreddit validation failed for every candidate; returning unvalidated suggestions.");

  return subreddits.slice(0, TARGET_SUBREDDIT_SUGGESTIONS);
}

async function getPublicSubredditReachability(subreddit: string): Promise<"reachable" | "unreachable" | "error"> {
  try {
    const response = await fetch(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/about.json`, {
      headers: {
        "User-Agent": process.env.REDDIT_RSS_USER_AGENT?.trim() || DEFAULT_REDDIT_USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(SUBREDDIT_VALIDATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      return "unreachable";
    }

    const payload = (await response.json()) as {
      kind?: string;
      data?: {
        display_name?: string;
        over18?: boolean;
        quarantine?: boolean;
        subreddit_type?: string;
      };
    };
    const displayName = payload.data?.display_name?.trim().toLowerCase();

    if (payload.kind !== "t5") {
      return "unreachable";
    }

    if (displayName !== subreddit) {
      return "unreachable";
    }

    if (payload.data?.over18 || payload.data?.quarantine) {
      return "unreachable";
    }

    return payload.data?.subreddit_type === "public" ? "reachable" : "unreachable";
  } catch {
    return "error";
  }
}

function getSuggestionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("OPENAI_API_KEY")) {
    return "OPENAI_API_KEY is not configured.";
  }

  if (message.includes("OpenAI web search request failed")) {
    return "Subreddit suggestion generation failed upstream. Check the server logs for the OpenAI web-search error.";
  }

  if (message.includes("OpenAI request failed")) {
    return "Subreddit suggestion generation failed upstream. Check the server logs for the OpenAI error.";
  }

  if (message.includes("timed out") || message.includes("aborted")) {
    return "Subreddit suggestion generation timed out.";
  }

  return "Could not generate subreddit suggestions right now.";
}

async function generateSubredditSuggestions(prompt: {
  systemPrompt: string;
  userPrompt: string;
  fallbackSystemPrompt: string;
}) {
  try {
    return await generateStructuredOutput({
      model: SUBREDDIT_DISCOVERY_MODEL,
      schemaName: "campaign_subreddit_suggestions",
      schema: responseSchema,
      systemPrompt: prompt.systemPrompt,
      temperature: 0.3,
      webSearch: {
        enabled: true,
        searchContextSize: SUBREDDIT_WEB_SEARCH_CONTEXT_SIZE,
      },
      userPrompt: prompt.userPrompt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!message.includes("timed out") && !message.includes("aborted")) {
      throw error;
    }

    console.warn("Subreddit web search timed out; retrying without web search.");

    return generateStructuredOutput({
      model: "gpt-5.1",
      schemaName: "campaign_subreddit_suggestions",
      schema: responseSchema,
      systemPrompt: prompt.fallbackSystemPrompt,
      temperature: 0.3,
      userPrompt: prompt.userPrompt.replace(
        "Search the web before answering. Use current Reddit pages and recent web references about Reddit communities to identify real subreddit names that still exist now.",
        "Use your knowledge to infer likely subreddit names, then rely on downstream validation to remove invalid or non-public communities.",
      ),
    });
  }
}

async function collectSubredditSuggestions(
  input: z.infer<typeof requestSchema>,
  existing: Set<string>,
) {
  const collected = new Set<string>();

  for (let attempt = 0; attempt < MAX_SUBREDDIT_SUGGESTION_ATTEMPTS; attempt += 1) {
    const remaining = TARGET_SUBREDDIT_SUGGESTIONS - collected.size;

    if (remaining <= 0) {
      break;
    }

    const response = await generateSubredditSuggestions(
      buildSubredditPrompt({
        description: input.description,
        existing: [...existing, ...collected],
        idealClient: input.idealClient,
        keywords: input.keywords,
        leadType: input.leadType,
        painPoints: input.painPoints,
        requestedCount: remaining,
      }),
    );
    console.info("Subreddit suggestion raw response", {
      attempt: attempt + 1,
      model: response.model,
      content: response.content,
    });

    const raw = z
      .object({
        suggestions: z.array(z.string()),
      })
      .parse(JSON.parse(response.content));

    console.info("Subreddit suggestion parsed output", {
      attempt: attempt + 1,
      count: raw.suggestions.length,
      suggestions: raw.suggestions,
    });

    for (const suggestion of raw.suggestions) {
      const normalized = normalizeSubreddit(suggestion);

      if (!normalized || existing.has(normalized) || collected.has(normalized)) {
        continue;
      }

      collected.add(normalized);

      if (collected.size >= TARGET_SUBREDDIT_SUGGESTIONS) {
        break;
      }
    }
  }

  return Array.from(collected).slice(0, TARGET_SUBREDDIT_SUGGESTIONS);
}

function buildSubredditPrompt(input: {
  description: string;
  existing: string[];
  idealClient?: string;
  keywords: string[];
  leadType: "PRODUCT" | "SERVICE";
  painPoints: string[];
  requestedCount: number;
}) {
  if (input.leadType === "PRODUCT") {
    return buildProductSubredditPrompt(input);
  }

  return buildServiceSubredditPrompt(input);
}

function buildServiceSubredditPrompt(input: {
  description: string;
  existing: string[];
  idealClient?: string;
  keywords: string[];
  leadType: "PRODUCT" | "SERVICE";
  painPoints: string[];
  requestedCount: number;
}) {
  return {
    systemPrompt: [
      "You recommend real, current, high-signal subreddits for Reddit lead generation for service businesses, agencies, consultants, and freelancers.",
      "",
      "Your goal is to find communities where people are likely to express:",
      "- requests for help",
      "- outsourcing intent",
      "- agency/freelancer/consultant needs",
      "- implementation or setup problems",
      "- painful manual workflows",
      "- broken processes",
      "- operational bottlenecks that could turn into service leads",
      "",
      "Prefer communities where users discuss problems that may lead to hiring outside help, not just communities that are topically related.",
      "",
      "Use live web search evidence to identify real subreddit names that currently exist, are public, and are active.",
      "",
      "Return only JSON matching the schema.",
    ].join("\n"),
    fallbackSystemPrompt:
      "You recommend plausible, high-signal subreddits for Reddit lead generation for service businesses. Return only JSON matching the schema.",
    userPrompt: `
You are helping a Reddit lead generation app recommend subreddits to monitor for possible service leads.

Search the web before answering. Use current Reddit pages and recent web references about Reddit communities to identify real subreddit names that still exist now.

Return JSON with a "suggestions" array of subreddit names only.

Rules:
- no "r/" prefix
- no explanation
- no markdown
- no duplicates
- real subreddit names only
- return exactly ${input.requestedCount} subreddits

Prioritize subreddits where people are likely to:
- ask for help
- ask who can do something
- ask for agency, freelancer, consultant, or expert recommendations
- complain about manual work
- struggle with operations, follow-ups, reporting, integrations, or workflows
- ask whether they should outsource something
- ask how to set something up
- describe a painful process they do not want to handle manually

Include a mix of:
- direct buyer-intent communities
- operator/practitioner communities
- adjacent workflow communities
- recommendation/help communities

Avoid:
- meme communities
- NSFW communities
- karma-farming communities
- entertainment communities
- huge generic communities when focused ones exist
- communities where people mostly share content instead of asking for help

Think in terms of likely service leads, not just topical relevance.

Service type: ${input.leadType}

Service description:
${input.description}

Ideal client:
${input.idealClient || "none"}

Problems solved:
${input.painPoints?.join(", ") || "none"}

Known keywords:
${input.keywords.join(", ") || "none"}

Already selected:
${input.existing.join(", ") || "none"}
  `.trim(),
  };
}

function buildProductSubredditPrompt(input: {
  description: string;
  existing: string[];
  keywords: string[];
  leadType: "PRODUCT" | "SERVICE";
  requestedCount: number;
}) {
  return {
    systemPrompt:
      "You recommend real, current, high-signal subreddits for Reddit lead generation. Use live web search evidence to find communities that are active, specific, and commercially relevant to the described offer. Return only JSON matching the schema.",
    fallbackSystemPrompt:
      "You recommend plausible, high-signal subreddits for Reddit lead generation. Return only JSON matching the schema.",
    userPrompt: `
You are helping a Reddit lead generation app recommend subreddits to monitor for possible leads.

Search the web before answering. Use current Reddit pages and recent web references about Reddit communities to identify real subreddit names that still exist now.

Return JSON with a "suggestions" array of subreddit names only.

Rules:
- no "r/" prefix
- no explanation
- no markdown
- no duplicates
- real subreddit names only
- prioritize subreddits likely to produce high-intent leads for the described offer
- prioritize subreddits where people ask for recommendations, alternatives, vendors, agencies, tools, software, workflows, outsourcing help, or operational advice related to the campaign
- include a mix of:
  - direct buyer-intent communities
  - operator or practitioner communities
  - adjacent workflow communities
  - communities where people ask for recommendations or tool alternatives
- prefer focused mid-signal and high-signal communities over huge generic communities when both are available
- prefer communities that are currently active and public
- infer relevant subreddits from the description even if the exact product category is not named
- avoid overly generic low-signal communities when more targeted ones exist
- avoid NSFW communities
- avoid meme, entertainment, giveaway, and karma-farming communities
- think in terms of likely lead sources, not just topical relevance
- return exactly ${input.requestedCount} subreddits

Campaign lead type: ${input.leadType}

Campaign description:
${input.description}

Known keywords:
${input.keywords.join(", ") || "none"}

Already selected:
${input.existing.join(", ") || "none"}
  `.trim(),
  };
}
