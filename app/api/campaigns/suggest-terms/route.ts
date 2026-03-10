import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";

const requestSchema = z.object({
  description: z.string().trim().min(10, "Add a more descriptive campaign description first."),
  leadType: z.enum(["PRODUCT", "SERVICE"]),
  kind: z.enum(["keywords", "negativeKeywords"]),
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
    const prompt =
      parsed.data.kind === "keywords"
        ? `
You are helping a Reddit lead generation app produce campaign keywords.

Return a JSON array of keyword phrases only.
Rules:
- no explanation
- no markdown
- no duplicates
- return between 8 and 14 items
- prioritize phrases that indicate buying intent, active evaluation, recommendation-seeking, or category search
- include both category terms and intent phrases
- keep phrases short and useful for Reddit matching

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
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
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
          .filter((item) => !parsed.data.existing.includes(item)),
      ),
    ).slice(0, 14);

    return NextResponse.json({ suggestions: normalized });
  } catch (error) {
    console.error("Gemini term suggestion failed", error);

    return NextResponse.json({ error: "Could not generate suggestions right now." }, { status: 500 });
  }
}
