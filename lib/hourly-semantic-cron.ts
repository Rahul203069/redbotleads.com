import { NextResponse } from "next/server";

import { completeCronRun, createCronRun, failCronRun } from "@/lib/cron-runs";
import { enqueueHourlySemanticCampaigns } from "@/lib/daily-semantic";

export async function handleHourlySemanticCronRequest(request: Request, path: string) {
  const url = new URL(request.url);
  const expectedSecret = process.env.CRON_SECRET?.trim();
  const probe = url.searchParams.get("probe") === "1";

  console.info("Hourly semantic trigger request received", {
    path,
    probe,
    hasCronSecret: Boolean(expectedSecret),
    userAgent: request.headers.get("user-agent"),
  });

  if (expectedSecret) {
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${expectedSecret}`) {
      console.warn("Hourly semantic trigger request rejected", {
        path,
        reason: authorization ? "invalid_authorization" : "missing_authorization",
      });

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("Hourly semantic trigger cannot run because CRON_SECRET is not configured", { path });
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  if (probe) {
    return NextResponse.json({
      ok: true,
      probe: true,
      path,
      ranAt: new Date().toISOString(),
    });
  }

  const cronRun = await createCronRun(path);

  try {
    const result = await enqueueHourlySemanticCampaigns({
      cronRunId: cronRun.id,
    });
    const message = [
      `Hourly semantic trigger queued ${result.queued} campaign${result.queued === 1 ? "" : "s"}.`,
      `${result.skipped} already queued or running.`,
      `${result.failed} failed.`,
    ].join(" ");

    await completeCronRun(cronRun.id, message, result);
    console.info("Hourly semantic trigger completed", {
      path,
      cronRunId: cronRun.id,
      scheduleBucket: result.scheduleBucket,
      eligible: result.eligible,
      queued: result.queued,
      skipped: result.skipped,
      failed: result.failed,
    });

    return NextResponse.json({
      ok: true,
      cronRunId: cronRun.id,
      ...result,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hourly semantic scheduler failed.";
    await failCronRun(cronRun.id, message);

    console.error("Hourly semantic trigger failed", {
      path,
      cronRunId: cronRun.id,
      error: message,
    });

    return NextResponse.json(
      {
        ok: false,
        cronRunId: cronRun.id,
        error: message,
      },
      { status: 500 },
    );
  }
}
