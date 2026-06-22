import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { BETA_OWNER_ONLY_MESSAGE, isOwnerEmail } from "@/lib/beta-access";
import { generateStructuredOutput } from "@/lib/openai";

const requestSchema = z.object({
  description: z.string().trim().min(10, "Add a more descriptive campaign description first."),
  leadType: z.enum(["PRODUCT", "SERVICE"]),
  idealClient: z.string().trim().optional(),
  painPoints: z.array(z.string()).default([]),
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

  if (!isOwnerEmail(session.user.email)) {
    return NextResponse.json({ error: BETA_OWNER_ONLY_MESSAGE }, { status: 403 });
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
You are helping a Reddit lead generation app produce campaign keyword phrases for a service business.

Return a JSON array of keyword phrases.
Rules:
- no explanation
- no markdown
- no duplicates
- return between 12 and 20 items
- each item should be 1 to 4 words
- use natural Reddit-style language
- prioritize phrases that indicate help-seeking, outsourcing intent, implementation need, workflow pain, or provider-search intent
- include both service-intent phrases and category-specific pain phrases
- avoid vague marketing phrases
- avoid generic buzzwords

Include phrases similar to:
- need help
- looking for someone
- recommend an agency
- hire someone
- outsource this
- set this up
- automate this
- manual process
- too much manual
- workflow is broken
- connect tools
- automate follow up

Campaign lead type: ${parsed.data.leadType}

Campaign description:
${parsed.data.description}

Ideal client:
${parsed.data.idealClient || "none"}

Problems solved:
${parsed.data.painPoints?.join(", ") || "none"}

Already selected:
${parsed.data.existing.join(", ") || "none"}
        `.trim()
        : `
You are helping a Reddit lead generation app produce negative keyword phrases for a service business.

Return a JSON array of negative keyword phrases only.
Rules:
- no explanation
- no markdown
- no duplicates
- return between 10 and 18 items
- prioritize phrases that indicate low buying intent, self-promotion, education-only content, DIY-only intent, job-seeking, full-time hiring, tutorials, case studies, or irrelevant traffic
- keep phrases short and useful for filtering

Include negative patterns like:
- I built
- I created
- my tool
- our tool
- case study
- how I automated
- tutorial
- guide
- course
- learning
- beginner
- job opening
- hiring full time
- looking for job
- portfolio
- free tool
- top tools
- comparison

Campaign lead type: ${parsed.data.leadType}

Campaign description:
${parsed.data.description}

Ideal client:
${parsed.data.idealClient || "none"}

Problems solved:
${parsed.data.painPoints?.join(", ") || "none"}

Already selected:
${parsed.data.existing.join(", ") || "none"}
        `.trim();

    const response = await generateStructuredOutput({
      model: "gpt-5.1",
      schemaName: parsed.data.kind === "keywords" ? "campaign_keyword_suggestions" : "campaign_negative_keyword_suggestions",
      schema: responseSchema,
      systemPrompt:
        parsed.data.kind === "keywords"
          ? "You generate high-signal Reddit lead generation keyword phrases for service businesses. Return only a JSON array matching the schema."
          : "You generate negative keyword phrases for Reddit lead generation campaigns for service businesses. Return only a JSON array matching the schema.",
      temperature: 0.3,
      userPrompt: prompt,
      usage: {
        userId: session.user.id,
        operation: parsed.data.kind === "keywords" ? "keyword_suggestion" : "negative_keyword_suggestion",
      },
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
          .filter((item) => !parsed.data.existing.includes(item)),
      ),
    ).slice(0, parsed.data.kind === "keywords" ? 20 : 18);

    return NextResponse.json({ suggestions: normalized });
  } catch (error) {
    console.error("OpenAI term suggestion failed", error);

    return NextResponse.json({ error: "Could not generate suggestions right now." }, { status: 500 });
  }
}
