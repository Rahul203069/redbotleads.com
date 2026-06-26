import { NextResponse } from "next/server";

import { enqueueDailySemanticCampaigns } from "@/lib/daily-semantic";

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET?.trim();

  if (expectedSecret) {
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  try {
    const result = await enqueueDailySemanticCampaigns();

    return NextResponse.json({
      ok: true,
      ...result,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Daily semantic scheduler failed.",
      },
      { status: 500 },
    );
  }
}
