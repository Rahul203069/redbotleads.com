import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";

const requestSchema = z.object({
  description: z.string().trim().min(10, "Add a more descriptive campaign description first."),
  leadType: z.enum(["PRODUCT", "SERVICE"]),
  keywords: z.array(z.string()).default([]),
  existing: z.array(z.string()).default([]),
});

const responseSchema = {
  type: "array",
  items: {
    type: "string",
  },
} as const;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors[0] ?? "Invalid request." }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
You are helping a Reddit lead generation app recommend subreddits to monitor.

Return a JSON array of subreddit names only.
Rules:
- no "r/" prefix
- no explanation
- no markdown
- no duplicates
- real subreddit names only
- prioritize subreddits likely to produce high-intent leads for the described offer
- avoid generic low-signal communities when more targeted ones exist
- avoid NSFW communities
- return between 6 and 10 subreddits

Campaign lead type: ${parsed.data.leadType}
Campaign description:
${parsed.data.description}

Known keywords:
${parsed.data.keywords.join(", ") || "none"}

Already selected:
${parsed.data.existing.join(", ") || "none"}
      `.trim(),
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.3,
      },
    });

    const raw = JSON.parse(response.text ?? "[]");
    const suggestions = z.array(z.string()).parse(raw);
    const normalized = Array.from(
      new Set(
        suggestions
          .map((item) => item.trim().toLowerCase().replace(/^r\//, ""))
          .filter(Boolean)
          .filter((item) => !parsed.data.existing.includes(item)),
      ),
    ).slice(0, 10);

    return NextResponse.json({ suggestions: normalized });
  } catch (error) {
    console.error("Gemini subreddit suggestion failed", error);

    return NextResponse.json({ error: "Could not generate subreddit suggestions right now." }, { status: 500 });
  }
}
