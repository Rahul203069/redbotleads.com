import { NextResponse } from "next/server";

import { completeCronRun, createCronRun, failCronRun } from "@/lib/cron-runs";
import { enqueueDailySemanticCampaigns } from "@/lib/daily-semantic";

const CRON_PATH = "/api/cron/daily-semantic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expectedSecret = process.env.CRON_SECRET?.trim();

  console.info("Daily semantic cron request received", {
    path: CRON_PATH,
    probe: url.searchParams.get("probe") === "1",
    hasCronSecret: Boolean(expectedSecret),
    userAgent: request.headers.get("user-agent"),
  });

  if (expectedSecret) {
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${expectedSecret}`) {
      console.warn("Daily semantic cron request rejected", {
        path: CRON_PATH,
        reason: authorization ? "invalid_authorization" : "missing_authorization",
      });

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("Daily semantic cron request cannot run because CRON_SECRET is not configured", {
      path: CRON_PATH,
    });

    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  if (url.searchParams.get("probe") === "1") {
    console.info("Daily semantic cron probe succeeded", {
      path: CRON_PATH,
    });

    return NextResponse.json({
      ok: true,
      probe: true,
      path: CRON_PATH,
      ranAt: new Date().toISOString(),
    });
  }

  const cronRun = await createCronRun(CRON_PATH);

  try {
    const result = await enqueueDailySemanticCampaigns({
      cronRunId: cronRun.id,
    });
    await completeCronRun(cronRun.id, `Daily semantic cron queued ${result.queued} campaign${result.queued === 1 ? "" : "s"}.`, result);

    console.info("Daily semantic cron completed", {
      path: CRON_PATH,
      cronRunId: cronRun.id,
      queued: result.queued,
      failed: result.failed,
    });

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

    console.error("Daily semantic cron failed", {
      path: CRON_PATH,
      cronRunId: cronRun.id,
      error: error instanceof Error ? error.message : "Daily semantic scheduler failed.",
    });

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
