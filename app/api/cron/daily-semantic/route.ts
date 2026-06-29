import { NextResponse } from "next/server";

import { completeCronRun, createCronRun, failCronRun } from "@/lib/cron-runs";
import { enqueueDailySemanticCampaigns } from "@/lib/daily-semantic";

const CRON_PATH = "/api/cron/daily-semantic";

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

  const cronRun = await createCronRun(CRON_PATH);

  try {
    const result = await enqueueDailySemanticCampaigns({
      cronRunId: cronRun.id,
    });
    await completeCronRun(cronRun.id, `Daily semantic cron queued ${result.queued} campaign${result.queued === 1 ? "" : "s"}.`, result);

    return NextResponse.json({
      ok: true,
      cronRunId: cronRun.id,
      ...result,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    await failCronRun(
      cronRun.id,
      error instanceof Error ? error.message : "Daily semantic scheduler failed.",
    );

    return NextResponse.json(
      {
        ok: false,
        cronRunId: cronRun.id,
        error: error instanceof Error ? error.message : "Daily semantic scheduler failed.",
      },
      { status: 500 },
    );
  }
}
