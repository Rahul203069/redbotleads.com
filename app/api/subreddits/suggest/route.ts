import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { generateStructuredOutput } from "@/lib/openai";

const requestSchema = z.object({
  description: z.string().trim().min(10, "Add a more descriptive campaign description first."),
  leadType: z.enum(["PRODUCT", "SERVICE"]),
  keywords: z.array(z.string()).default([]),
  existing: z.array(z.string()).default([]),
});

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
    const response = await generateStructuredOutput({
      model: "gpt-5.1",
      schemaName: "campaign_subreddit_suggestions",
      schema: responseSchema,
      systemPrompt:
        "You recommend real, high-signal subreddits for Reddit lead generation. Infer likely buyer communities, operator communities, workflow communities, problem-aware communities, and tool-evaluation communities from the product description. Return only JSON matching the schema.",
      temperature: 0.3,
      userPrompt: `
You are helping a Reddit lead generation app recommend subreddits to monitor.

Return JSON with a "suggestions" array of subreddit names only.
Rules:
- no "r/" prefix
- no explanation
- no markdown
- no duplicates
- real subreddit names only
- prioritize subreddits likely to produce high-intent leads for the described offer
- include a mix of:
  - direct buyer-intent communities
  - operator or practitioner communities
  - adjacent workflow communities
  - communities where people ask for recommendations or tool alternatives
- infer relevant subreddits from the description even if the exact product category is not named
- avoid overly generic low-signal communities when more targeted ones exist
- avoid NSFW communities
- return between 10 and 14 subreddits

Campaign lead type: ${parsed.data.leadType}
Campaign description:
${parsed.data.description}

Known keywords:
${parsed.data.keywords.join(", ") || "none"}

Already selected:
${parsed.data.existing.join(", ") || "none"}
      `.trim(),
    });

    const raw = z
      .object({
        suggestions: z.array(z.string()),
      })
      .parse(JSON.parse(response.content));
    const suggestions = raw.suggestions;
    const normalized = Array.from(
      new Set(
        suggestions
          .map((item) => item.trim().toLowerCase().replace(/^r\//, ""))
          .filter(Boolean)
          .filter((item) => !parsed.data.existing.includes(item)),
      ),
    ).slice(0, 14);

    return NextResponse.json({ suggestions: normalized });
  } catch (error) {
    console.error("OpenAI subreddit suggestion failed", error);

    return NextResponse.json({ error: "Could not generate subreddit suggestions right now." }, { status: 500 });
  }
}
