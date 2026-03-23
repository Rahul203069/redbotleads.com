import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { generateStructuredOutput } from "@/lib/openai";

const requestSchema = z.object({
  description: z.string().trim().min(10, "Add a more descriptive campaign description first."),
  leadType: z.enum(["PRODUCT", "SERVICE"]),
  kind: z.enum(["keywords", "negativeKeywords"]),
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
    const prompt =
      parsed.data.kind === "keywords"
        ? `
You are helping a Reddit lead generation app produce campaign keywords.

Return a JSON array of single-word keywords only.
Rules:
- no explanation
- no markdown
- no duplicates
- return between 8 and 14 items
- every item must be exactly one word
- no spaces
- no multi-word phrases
- prioritize phrases that indicate buying intent, active evaluation, recommendation-seeking, or category search
- include both category terms and intent signals when they can be expressed as one word
- keep words short and useful for Reddit matching

Campaign lead type: ${parsed.data.leadType}
Campaign description:
${parsed.data.description}

Already selected:
${parsed.data.existing.join(", ") || "none"}
        `.trim()
        : `
You are helping a Reddit lead generation app produce negative keywords.

Return a JSON array of negative keyword phrases only.
Rules:
- no explanation
- no markdown
- no duplicates
- return between 6 and 12 items
- prioritize phrases that indicate low buyer intent, low fit, hobby usage, student usage, free-only intent, or irrelevant traffic
- keep phrases short and useful for filtering

Campaign lead type: ${parsed.data.leadType}
Campaign description:
${parsed.data.description}

Already selected:
${parsed.data.existing.join(", ") || "none"}
        `.trim();

    const response = await generateStructuredOutput({
      model: "gpt-5.1",
      schemaName: parsed.data.kind === "keywords" ? "campaign_keyword_suggestions" : "campaign_negative_keyword_suggestions",
      schema: responseSchema,
      systemPrompt:
        parsed.data.kind === "keywords"
          ? "You generate high-signal Reddit lead generation keywords. Return only a JSON array matching the schema."
          : "You generate negative keywords for Reddit lead generation campaigns. Return only a JSON array matching the schema.",
      temperature: 0.3,
      userPrompt: prompt,
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
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
          .filter((item) => (parsed.data.kind === "keywords" ? !/\s/.test(item) : true))
          .filter((item) => !parsed.data.existing.includes(item)),
      ),
    ).slice(0, 14);

    return NextResponse.json({ suggestions: normalized });
  } catch (error) {
    console.error("OpenAI term suggestion failed", error);

    return NextResponse.json({ error: "Could not generate suggestions right now." }, { status: 500 });
  }
}
